"""Real HTTP acceptance for an isolated, restored guidance release clone.

The caller binds all three adapters to the internal-network clone. This checks
the existing server contracts directly, including real ONNX publication; it
does not provide substitute model or API implementations. SQL fixtures and
synthetic articles must never be directed at production.
"""

import json
import time
from urllib.parse import urlencode
import uuid


EMBEDDING_SPACE = '785d7d1f0f013aa4679042e683fc3f31f1dcc1fbca2edbaa0bf81786c805193b'
ARTICLES = '/api/admin/assistant-knowledge/articles'
SEARCH = '/api/me/assistant-knowledge/search?'
SOURCES = '/api/me/assistant-knowledge/sources/'


def run_checks(api, sql, register):
    """Return non-secret evidence after exercising the real isolated application.

    api(method, path, body=None, cookie=None, csrf=None) returns status, payload,
    cookie. sql(query) returns text. register('member'/'admin') returns cookie,
    csrf, account_id; the caller supplies its configured clone administrator.
    """
    member_cookie, member_csrf, member_account = register('member')
    admin_cookie, admin_csrf, admin_account = register('admin')
    member_account, admin_account = str(uuid.UUID(member_account)), str(uuid.UUID(admin_account))
    assert member_account != admin_account, 'Canary requires distinct member and administrator accounts'

    def call(method, path, body=None, *, actor='member', csrf=True, expected=200, code=None):
        cookie, token = {
            'member': (member_cookie, member_csrf),
            'admin': (admin_cookie, admin_csrf),
            'anonymous': (None, None),
        }[actor]
        status, payload, _ = api(method, path, body, cookie, token if csrf else None)
        assert status == expected, ('Guidance canary HTTP status', method, path, status, expected)
        if code:
            assert payload.get('error', {}).get('code') == code, ('Guidance canary error contract', method, path)
        return payload

    def counts():
        return json.loads(sql("SELECT json_build_object('executions',(SELECT count(*) FROM agent_executions),'modelCalls',(SELECT count(*) FROM agent_model_calls))"))

    initial_counts = counts()
    wallet = call('GET', '/api/wallet')
    call('POST', '/api/me/global-assistant/open', {}, csrf=False, expected=403)
    opened = call('POST', '/api/me/global-assistant/open', {})
    conversation = str(uuid.UUID(opened['conversationId']))
    reopened = call('POST', '/api/me/global-assistant/open', {})
    assert reopened['conversationId'] == conversation and reopened['bindingVersion'] == opened['bindingVersion'], 'Global open created a second binding'
    assert len(opened['messages']) == 1 and opened['syncCursor'], 'New global conversation lacks its opening or sync cursor'
    legacy = call('POST', '/api/me/tavern/management-conversations', {})
    assert legacy['conversation']['conversationId'] == conversation, 'Legacy open does not attach to the canonical conversation'
    call('POST', '/api/me/tavern/management-conversations',
         {'newConversation': True, 'clientRequestId': str(uuid.uuid4())},
         expected=409, code='global_assistant_client_upgrade_required')
    route = '/api/me/tavern/conversations/' + conversation
    call('POST', route + '/turns', {
        'clientActionId': 'guidance-old-turn-' + uuid.uuid4().hex,
        'expectedRevision': opened['graphRevision'],
        'action': {'type': 'reply', 'message': '隔离发布验收：此旧入口不得发起模型请求。'},
    }, expected=409, code='global_assistant_client_upgrade_required')
    for method, suffix, command in [
        ('PATCH', '/profile', {'expectedRevision': opened['graphRevision'], 'userName': 'blocked', 'persona': 'blocked'}),
        ('PATCH', '/canvas', {'expectedRevision': opened['graphRevision'], 'enabled': True, 'elements': []}),
        ('DELETE', '', None),
    ]:
        call(method, route + suffix, command, expected=403)

    # A valid saved profile avoids proving only "model missing" rejection. The
    # new clone-owned conversation/branch models an old noncanonical history.
    profiles = json.loads(sql("""SELECT coalesce(json_agg(r),'[]') FROM (
        SELECT p.profile_id AS "profileId",p.profile_version AS "profileVersion",p.funding
        FROM agent_model_profiles p JOIN agent_model_profile_verifications v USING(profile_id,profile_version)
        WHERE p.funding='cash' ORDER BY p.profile_id,p.profile_version DESC LIMIT 1) r"""))
    noncanonical = {'checked': False, 'boundary': 'no_existing_verified_cash_profile; no execution request sent'}
    if profiles:
        historical, branch = str(uuid.uuid4()), str(uuid.uuid4())
        inserted = sql(f"""WITH copied AS (
            INSERT INTO tavern_conversations(conversation_id,account_id,character_id,title,user_name,
                persona,vocabulary,opening_message,card_snapshot,config_fingerprint,system_prompt,
                active_branch_id,scene)
            SELECT '{historical}'::uuid,account_id,character_id,'Isolated historical canary',user_name,
                persona,vocabulary,opening_message,card_snapshot,config_fingerprint,system_prompt,
                '{branch}'::uuid,'management' FROM tavern_conversations
            WHERE account_id='{member_account}'::uuid AND conversation_id='{conversation}'::uuid
            RETURNING account_id,conversation_id)
            INSERT INTO tavern_branches(branch_id,account_id,conversation_id,name,kind)
            SELECT '{branch}'::uuid,account_id,conversation_id,'Isolated historical canary','main' FROM copied
            RETURNING conversation_id::text""").strip()
        assert inserted == historical, 'Could not construct a valid clone-owned historical conversation'
        profile = profiles[0]
        call('POST', '/api/me/tavern/conversations/' + historical + '/executions', {
            'clientActionId': 'guidance-old-execution-' + uuid.uuid4().hex,
            'expectedRevision': 0, 'bindingVersion': opened['bindingVersion'],
            'action': {'type': 'reply', 'message': '隔离发布验收：非当前全局会话不得执行。'},
            'funding': 'cash', 'profileId': profile['profileId'], 'profileVersion': profile['profileVersion'],
        }, expected=409, code='global_conversation_not_current')
        noncanonical = {'checked': True, 'status': 409, 'errorCode': 'global_conversation_not_current', 'existingVerifiedProfile': True}
    assert counts() == initial_counts, 'A rejected old request created an execution or model call'

    marker = uuid.uuid4().hex
    draft = {
        'title': '全局助手隔离验收 ' + marker,
        'markdown': '# 隔离发布验收\n\n这是一篇用于验证草稿保密和修订历史的合成帮助文章。',
        'category': '使用指南', 'aliases': [], 'keywords': ['全局助手', '隔离验收', marker],
        'sourceNote': 'Synthetic content in the isolated release clone only.',
    }
    call('GET', ARTICLES, actor='anonymous', expected=401)
    call('GET', ARTICLES, expected=403)
    call('POST', ARTICLES, draft, expected=403)
    call('POST', ARTICLES, draft, actor='admin', csrf=False, expected=403)
    created = call('POST', ARTICLES, draft, actor='admin', expected=201)
    article_id = str(uuid.UUID(created['articleId']))
    original_revision = str(uuid.UUID(created['draftRevisionId']))
    assert created['version'] == 1 and created['publishedRevisionId'] is None, 'New draft was automatically published'
    article_route = ARTICLES + '/' + article_id
    edited_draft = {**draft, 'markdown': '# 全局助手使用指南\n\n全局助手会保留同一个网站咨询会话。管理员可以编辑帮助草稿，核对原文后再发布；下架后资料不再出现在新的检索结果中。\n\n隔离验收标记：' + marker}
    edit = {'expectedVersion': created['version'], **edited_draft}
    publication = {'expectedVersion': created['version'], 'revisionId': original_revision, 'operationId': str(uuid.uuid4())}
    mutation = {'expectedVersion': created['version'], 'operationId': str(uuid.uuid4())}
    for method, path, command in [
        ('PUT', article_route, edit), ('POST', article_route + '/publish', publication),
        ('POST', article_route + '/rollback', publication), ('POST', article_route + '/unpublish', mutation),
        ('DELETE', article_route, mutation),
    ]:
        call(method, path, command, expected=403)
        call(method, path, command, actor='admin', csrf=False, expected=403)
    edited = call('PUT', article_route, edit, actor='admin')
    revision = str(uuid.UUID(edited['draftRevisionId']))
    assert edited['version'] == 2 and revision != original_revision, 'Editing did not append an immutable revision'
    call('PUT', article_route, edit, actor='admin', expected=409, code='assistant_knowledge.version_conflict')
    revisions = call('GET', article_route + '/revisions', actor='admin')['items']
    assert len(revisions) == 2 and {item['markdown'] for item in revisions} == {draft['markdown'], edited_draft['markdown']}, 'An immutable draft revision changed'
    call('GET', SOURCES + original_revision, expected=404)
    call('GET', SOURCES + revision, expected=404)
    query = SEARCH + urlencode({'query': '全局助手 隔离验收 ' + marker, 'limit': 10})
    before_publish = call('GET', query)
    assert not any(hit['articleId'] == article_id for hit in before_publish['sources']), 'Private draft leaked through search'

    publish_command = {'expectedVersion': edited['version'], 'revisionId': revision, 'operationId': str(uuid.uuid4())}
    queued = call('POST', article_route + '/publish', publish_command, actor='admin', expected=202)
    assert queued['targetRevisionId'] == revision, 'Publication targets the wrong revision'
    job_id = str(uuid.UUID(queued['latestJob']['jobId']))
    deadline = time.monotonic() + 90
    while True:
        published = call('GET', article_route, actor='admin')
        assert published['indexStatus'] != 'failed', 'Actual ONNX publication failed in the clone'
        if published['indexStatus'] == 'published':
            break
        assert time.monotonic() < deadline, 'Actual ONNX publication did not complete within 90 seconds'
        time.sleep(.5)
    assert published['publishedRevisionId'] == revision and published['latestJob']['jobId'] == job_id and published['latestJob']['status'] == 'succeeded', 'Publication did not complete its frozen job'
    indexed = json.loads(sql(f"""SELECT json_build_object('status',j.status,'spaceId',j.embedding_metadata->>'spaceId',
        'chunks',count(c.*),'minimumDimensions',min(vector_dims(c.embedding)),
        'maximumDimensions',max(vector_dims(c.embedding))) FROM assistant_knowledge_jobs j
        JOIN assistant_knowledge_chunks c ON c.job_id=j.job_id
        WHERE j.job_id='{job_id}'::uuid AND j.article_id='{article_id}'::uuid AND j.revision_id='{revision}'::uuid
        GROUP BY j.job_id"""))
    assert indexed['status'] == 'succeeded' and indexed['spaceId'] == EMBEDDING_SPACE and indexed['chunks'] > 0 and indexed['minimumDimensions'] == indexed['maximumDimensions'] == 512, 'Published chunks lack the verified real embedding identity'
    retrieved = call('GET', query)
    assert retrieved['mode'] == 'hybrid', 'Knowledge retrieval silently fell back to keyword mode'
    assert any(hit['articleId'] == article_id and hit['sourceId'] == revision and hit['revisionId'] == revision for hit in retrieved['sources']), 'Hybrid retrieval did not return the new published revision'
    source = call('GET', SOURCES + revision)
    assert source['sourceId'] == revision and source['articleId'] == article_id and source['markdown'] == edited_draft['markdown'], 'Source does not open the published original'
    call('GET', SOURCES + revision, actor='anonymous', expected=401)
    call('GET', SOURCES + original_revision, expected=404)
    down = call('POST', article_route + '/unpublish', {
        'expectedVersion': published['version'], 'operationId': str(uuid.uuid4()),
    }, actor='admin')
    assert down['publishedRevisionId'] is None and down['indexStatus'] == 'unpublished', 'Article remained published after unpublish'
    hidden = call('GET', query)
    assert not any(hit['articleId'] == article_id for hit in hidden['sources']), 'Unpublished article remained visible to new search'
    call('GET', SOURCES + revision, expected=404, code='assistant_knowledge.source_unavailable')
    assert call('GET', '/api/wallet') == wallet, 'Canary charged or modified the member wallet'
    assert counts() == initial_counts, 'Knowledge acceptance or old-client rejection created a model execution'
    return {
        'canonicalOpenStable': True, 'legacyCannotCreateNew': True, 'legacyTurnsRejected': True,
        'globalConfigurationProtected': True, 'noncanonicalExecution': noncanonical,
        'adminMembershipAndCsrfEnforced': True, 'privateDraftsAndImmutableRevisions': True,
        'actualOnnxIndexing': True, 'embeddingSpaceId': EMBEDDING_SPACE,
        'indexedChunks': indexed['chunks'], 'indexJobId': job_id, 'articleId': article_id,
        'hybridRetrieval': True, 'publishedOriginalVerified': True, 'unpublishHidesSource': True,
        'walletUnchanged': True, 'newAgentExecutions': 0, 'newModelCalls': 0,
    }
