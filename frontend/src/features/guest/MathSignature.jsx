// A projected tracing of the same Möbius parameterisation, not another renderer.
const ribbons = Array.from({ length: 7 }, (_, row) => {
  const v = -0.43 + (row / 6) * 0.86;
  return Array.from({ length: 129 }, (_, i) => {
    const u = (i / 128) * Math.PI * 2;
    const x = (1 + v * Math.cos(u / 2)) * Math.cos(u);
    const y = (1 + v * Math.cos(u / 2)) * Math.sin(u);
    const z = v * Math.sin(u / 2);
    return `${i ? "L" : "M"}${(300 + x * 170).toFixed(2)},${(150 + (y * 0.4 + z * 0.9) * 155).toFixed(2)}`;
  }).join(" ");
});
export default function MathSignature() {
  return (
    <svg className="mc-signature" viewBox="0 0 600 300" aria-hidden="true">
      <path className="mc-signature-axis" d="M0 150H600M300 0V300" />
      {ribbons.map((d, i) => (
        <path key={i} d={d} pathLength="1" style={{ "--ribbon": i }} />
      ))}
    </svg>
  );
}
