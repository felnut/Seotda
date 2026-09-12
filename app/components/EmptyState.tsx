// 방 찾기·랭킹처럼 데이터가 아직 없는 화면에서 텍스트 한 줄 + 큰 여백으로만
// 때우지 않도록, 섯다 카드 모티프의 작은 일러스트를 곁들인 공용 빈 상태.
export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="animate-fade-up flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
      <svg
        width="72"
        height="58"
        viewBox="0 0 72 58"
        fill="none"
        aria-hidden
        className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
      >
        <rect
          x="6"
          y="10"
          width="34"
          height="46"
          rx="6"
          transform="rotate(-10 6 10)"
          fill="#191b1e"
          stroke="#dba95a"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
        <rect
          x="32"
          y="6"
          width="34"
          height="46"
          rx="6"
          transform="rotate(8 32 6)"
          fill="#23262b"
          stroke="#dba95a"
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
        <circle cx="49" cy="27" r="7" fill="#dba95a" fillOpacity="0.18" />
        <circle cx="49" cy="27" r="2.5" fill="#f0cb85" fillOpacity="0.7" />
      </svg>

      <p className="text-[15.5px] font-semibold text-zinc-300">{title}</p>

      {subtitle && (
        <p className="max-w-55 text-[13.5px] text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}
