import React from "react";
import { View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Line,
  Circle,
} from "react-native-svg";
import { colors, Label, Row } from "./ui";
export function Chart({
  points,
  labels,
}: {
  points: number[];
  labels: string[];
}) {
  const max = Math.max(...points, 1) * 1.2,
    min = 0;
  const coords = points.map((v, i) => [
    24 + (i / Math.max(1, points.length - 1)) * 552,
    150 - ((v - min) / (max - min)) * 125,
  ]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <View style={{ gap: 10 }}>
      <Svg
        width="100%"
        height={180}
        viewBox="0 0 600 180"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.lime} stopOpacity={0.23} />
            <Stop offset="1" stopColor={colors.lime} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[30, 70, 110, 150].map((y) => (
          <Line
            key={y}
            x1={0}
            x2={600}
            y1={y}
            y2={y}
            stroke={colors.line}
            strokeDasharray="4 5"
          />
        ))}
        {line && (
          <>
            <Path
              d={`${line} L${coords.at(-1)![0]},165 L24,165 Z`}
              fill="url(#fill)"
            />
            <Path d={line} stroke={colors.lime} strokeWidth={3} fill="none" />
            {coords.map(([x, y], i) => (
              <Circle key={i} cx={x} cy={y} r={4} fill={colors.lime} />
            ))}
          </>
        )}
      </Svg>
      <Row style={{ justifyContent: "space-between" }}>
        <Label small muted>
          {labels[0]}
        </Label>
        <Label small muted>
          {labels.at(-1)}
        </Label>
      </Row>
    </View>
  );
}
