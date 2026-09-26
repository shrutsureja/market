import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { date, flowShare, number, pct, signed } from "../lib/format.js";

const POSITIVE = "#2a9d4a";
const NEGATIVE = "#df514c";
const NEUTRAL = "#387ed1";

function bar(colorBySign) {
  return ({ x, y, width, height, payload }) => {
    const fill = colorBySign ? (payload.value > 0 ? POSITIVE : payload.value < 0 ? NEGATIVE : "#ccc") : NEUTRAL;
    // Recharts hands below-baseline bars a negative height; an SVG rect with a negative
    // height doesn't render at all, so normalize to a top-left corner and a positive size.
    const top = height < 0 ? y + height : y;
    return <rect x={x} y={top} width={width} height={Math.abs(height)} fill={fill} rx={3} ry={3} />;
  };
}

export function FlowChart({ rows, field, colorBySign = false }) {
  const data = rows.map((r) => ({ label: date(r.reportDate), value: r[field], openingAuc: r.openingAucCr }));
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9b9b9b" }} axisLine={{ stroke: "#eee" }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#9b9b9b" }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => number(v)} />
          <Tooltip
            formatter={(value, _name, entry) => [colorBySign ? `${signed(value)} Cr (${pct(flowShare(value, entry.payload.openingAuc))} of AUC)` : `${number(value)} Cr`, colorBySign ? "Net flow" : "Equity AUC"]}
            labelStyle={{ color: "#222", fontWeight: 600 }}
            contentStyle={{ borderRadius: 3, border: "1px solid #e1e1e1", fontSize: 12 }}
          />
          <Bar dataKey="value" maxBarSize={36} shape={bar(colorBySign)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
