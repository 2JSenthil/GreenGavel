const bubbles = [
  { left: "6%", size: 22, delay: "0s" },
  { left: "18%", size: 36, delay: "3s" },
  { left: "34%", size: 18, delay: "7s" },
  { left: "52%", size: 44, delay: "1.5s" },
  { left: "68%", size: 26, delay: "5s" },
  { left: "82%", size: 16, delay: "9s" },
  { left: "92%", size: 32, delay: "4s" },
  { left: "12%", size: 14, delay: "2s" },
  { left: "46%", size: 28, delay: "6s" },
  { left: "74%", size: 20, delay: "8s" },
];

export default function Bubbles() {
  return (
    <div aria-hidden="true">
      {bubbles.map((bubble) => (
        <span
          key={bubble.left}
          className="bubble"
          style={{
            left: bubble.left,
            width: bubble.size,
            height: bubble.size,
            animationDelay: bubble.delay,
          }}
        />
      ))}
    </div>
  );
}
