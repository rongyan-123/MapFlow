import copy

def assert_frontend_config(before, after, revision):
    expected=copy.deepcopy(before)
    for name in ['com.mapflow.frontend.revision','dev.mapflow.frontend.revision']:
        expected['labels'][name]=revision
    assert after==expected, 'Frontend release changed existing runtime settings'

def assert_knowledge_config(before, after, app_id, old_image, new_image):
    assert old_image==new_image, 'Knowledge image changed'
    expected=copy.deepcopy(before)
    expected['host']['NetworkMode']='container:'+app_id
    assert after==expected, 'Knowledge configuration or namespace differs'
