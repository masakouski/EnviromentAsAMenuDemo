const MENU_ITEMS = [
  { key: "writing", label: "Writing" },
  { key: "working", label: "Working" },
  { key: "gaming", label: "Gaming" },
];

export default function Menu({ activeTarget, onHover, onLeave }) {
  return (
    <div className="menu-overlay">
      {MENU_ITEMS.map((item) => (
        <div
          key={item.key}
          className={`menu-item ${activeTarget === item.key ? "active" : ""}`}
          onMouseEnter={() => onHover(item.key)}
          onMouseLeave={() => onLeave()}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
