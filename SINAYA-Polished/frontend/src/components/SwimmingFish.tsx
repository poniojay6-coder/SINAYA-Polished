export default function SwimmingFish() {
  return (
    <div className="fish-track" aria-hidden="true">
      <div className="fish-swimmer">
        <div className="fish-wake">
          <span /><span /><span /><span />
        </div>
      <svg
        className="swimming-fish"
        viewBox="0 0 240 120"
        fill="none"
      >
        <defs>
          <linearGradient id="fish-color" x1="30" y1="20" x2="200" y2="100">
            <stop stopColor="#249F93" />
            <stop offset="1" stopColor="#7AE8D4" />
          </linearGradient>
        </defs>

        <g className="fish-tail">
          <path
            d="M80 60 20 18 30 60 20 102Z"
            fill="#249F93"
          />
        </g>

        <path
          d="M68 60C106 8 171 9 218 60C171 111 106 112 68 60Z"
          fill="url(#fish-color)"
        />
        <path
          d="M107 28 137 8 164 28"
          fill="#249F93"
        />
        <path
          className="fish-fin"
          d="M117 78 140 105 158 81"
          fill="#168C8A"
        />
        <path
          d="M174 40Q160 60 174 80"
          stroke="#101B38"
          strokeWidth="3"
          opacity=".35"
        />
        <circle cx="188" cy="48" r="5" fill="#101B38" />
        <circle cx="190" cy="46" r="1.5" fill="#F5F5F5" />
        <path d="M100 48Q142 24 181 42" stroke="#D8FFF5" strokeWidth="3" strokeLinecap="round" opacity=".3" />
      </svg>
      </div>
    </div>
  );
}


