const MENU_ITEMS = [
  { key: "writing", label: "Writing" },
  { key: "working", label: "Working" },
  { key: "gaming", label: "Gaming" },
];

export default function Menu({ activeTarget, onHover, onLeave }) {
  const handleTap = (key) => {
    // On touch: toggle — tap once to activate, tap again to deactivate
    if (activeTarget === key) {
      onLeave();
    } else {
      onHover(key);
    }
  };

  return (
    <div className="menu-overlay">
      {MENU_ITEMS.map((item) => (
        <div
          key={item.key}
          className={`menu-item ${activeTarget === item.key ? "active" : ""}`}
          onMouseEnter={() => onHover(item.key)}
          onMouseLeave={() => onLeave()}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleTap(item.key);
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
