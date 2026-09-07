const STORY_SECTIONS = [
  {
    index: '01',
    id: 'route',
    eyebrow: '从一个问题开始',
    title: '选一个好奇的问题，往下追。',
    detail: '不用先把整门课从头看完。把眼前的问题说出来，MapFlow 会把它放进一张能继续走的学习地图。',
    accent: 'teal',
  },
  {
    index: '02',
    id: 'evidence',
    eyebrow: '走出下一步',
    title: '你弄懂的，都会留下痕迹。',
    detail: '沿着前置关系理解目标，在卡住的地方提问，再用练习或结果确认自己真的往前走了一格。',
    accent: 'coral',
  },
] as const;

export default function LandingStory() {
  return (
    <section
      id="route"
      data-testid="landing-story"
      className="border-b border-[#dce7e1] bg-[#fbfaf6]"
      aria-labelledby="workflow-title"
    >
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.18em] text-[#176f70]">THE MAPFLOW ROUTE</p>
          <h2 id="workflow-title" className="mt-4 text-3xl font-black tracking-[-0.045em] text-[#16383b] sm:text-5xl">
            学习不是从目录开始，而是从你此刻的问题开始。
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#607477] sm:text-base">
            一张地图让你看见全局，但每一次前进都只需要处理眼前的下一步。
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {STORY_SECTIONS.map((section) => (
            <article
              key={section.index}
              id={section.index === '02' ? section.id : undefined}
              data-testid={`landing-story-chapter-${section.index}`}
              className="grid gap-8 rounded-[1.75rem] border border-[#dce7e1] bg-white/75 p-6 sm:p-8 md:grid-cols-[0.88fr_1.12fr] md:items-center"
            >
              <StoryMapIllustration accent={section.accent} />
              <div>
                <div className="flex items-center gap-3 text-xs font-bold tracking-[0.16em] text-[#82918f]">
                  <span className={section.accent === 'teal' ? 'text-[#176f70]' : 'text-[#c16d4a]'}>
                    /{section.index}
                  </span>
                  <span>{section.eyebrow}</span>
                </div>
                <h3 className="mt-5 text-2xl font-black leading-tight tracking-[-0.035em] text-[#16383b]">
                  {section.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[#607477]">{section.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StoryMapIllustration({ accent }: { accent: 'teal' | 'coral' }) {
  const lineColor = accent === 'teal' ? '#9bc8ba' : '#dfad91';
  const nodeColor = accent === 'teal' ? '#176f70' : '#e07a52';

  return (
    <div className="relative flex min-h-44 items-center justify-center overflow-hidden rounded-2xl bg-[#f1f6f1] p-4">
      <svg viewBox="0 0 280 180" className="h-full w-full" fill="none" aria-hidden="true">
        <path
          d="M28 130C76 116 72 49 124 54C174 59 153 130 207 122C231 119 242 91 254 58"
          stroke={lineColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="7 9"
        />
        <circle cx="28" cy="130" r="10" fill={nodeColor} />
        <circle cx="124" cy="54" r="10" fill="#fff" stroke={nodeColor} strokeWidth="4" />
        <circle cx="207" cy="122" r="10" fill={nodeColor} />
        <circle cx="254" cy="58" r="10" fill="#fff" stroke={nodeColor} strokeWidth="4" />
      </svg>
      <span className="absolute left-5 top-4 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-[#607477]">
        {accent === 'teal' ? 'Python 基础' : '模型调用节点'}
      </span>
      <span className="absolute left-1/2 top-[42%] -translate-x-1/2 rounded-lg border border-[#dce7e1] bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-[#176f70]">
        {accent === 'teal' ? 'HTTP 请求节点' : '工具调用节点'}
      </span>
      <span className="absolute bottom-4 right-5 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-[#607477]">
        {accent === 'teal' ? '模型调用节点' : '返回可验证结果'}
      </span>
    </div>
  );
}
