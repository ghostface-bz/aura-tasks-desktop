interface TagFilterBarProps {
  tags: string[];
  selected: string | null;
  onSelect: (tag: string) => void;
}

export default function TagFilterBar({ tags, selected, onSelect }: TagFilterBarProps) {
  if (tags.length === 0) return null;

  return (
    <div className="tag-filter-bar">
      {tags.map((tag) => (
        <button
          key={tag}
          className={`tag-chip ${selected === tag ? "active" : ""}`}
          onClick={() => onSelect(tag)}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}
