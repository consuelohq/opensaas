// GoHighLevel logo — upward arrow/chevron mark
export const IconGoHighLevel = ({
  size = 24,
  color = 'currentColor',
  className,
  style,
}: IconGoHighLevelProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    <path d="M12 3L4 13h5.5v8h5v-8H20L12 3z" fill={color} />
  </svg>
);
