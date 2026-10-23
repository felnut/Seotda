"use client";

import { useState } from "react";
import Image from "next/image";
import { HAND_GUIDE } from "@/lib/seotda/handGuide";

export function CardPair({
  ids,
  name,
}: {
  ids: [string, string];
  name: string;
}) {
  return (
    <div className="hand-pair">
      {ids.map((id, index) => (
        <Image
          key={id}
          src={`/card/${id}.png`}
          alt={`${name} ${index + 1}번째 카드`}
          width={64}
          height={96}
        />
      ))}
    </div>
  );
}

export function HandRankings() {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <ol id="hand-rankings" className="hand-grid">
        {(expanded ? HAND_GUIDE : HAND_GUIDE.slice(0, 6)).map((hand, index) => (
          <li key={hand.name} className="hand-tile">
            <div>
              <span className="hand-rank">{index + 1}</span>
              <h3>{hand.name}</h3>
              <p>{hand.months}</p>
            </div>
            <CardPair ids={hand.cardIds} name={hand.name} />
          </li>
        ))}
      </ol>
      <button
        className="expand-hands"
        aria-expanded={expanded}
        aria-controls="hand-rankings"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "족보 접기 ↑" : "전체 족보 펼쳐보기 ↓"}
      </button>
    </>
  );
}
