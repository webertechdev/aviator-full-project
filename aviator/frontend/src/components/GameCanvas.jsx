import { useEffect, useRef } from "react";

export default function GameCanvas({ multiplier, gamePhase }) {
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const frameRef = useRef(null);

  useEffect(() => {
    if (gamePhase === "waiting") {
      historyRef.current = [];
    }
    if (gamePhase === "flying" || gamePhase === "crashed") {
      historyRef.current.push(multiplier);
    }
    draw();
  }, [multiplier, gamePhase]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    if (gamePhase === "waiting") {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = "bold 20px 'Courier New'";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for next round...", W / 2, H / 2);
      return;
    }

    const history = historyRef.current;
    if (history.length < 2) return;

    const maxM = Math.max(...history, 2);
    const padL = 50, padB = 40;
    const drawW = W - padL - 20;
    const drawH = H - padB - 20;

    function toX(i) { return padL + (i / (history.length - 1)) * drawW; }
    function toY(m) { return H - padB - ((m - 1) / (maxM - 1)) * drawH; }

    // Gradient fill under curve
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (gamePhase === "crashed") {
      grad.addColorStop(0, "rgba(255,60,60,0.4)");
      grad.addColorStop(1, "rgba(255,60,60,0.01)");
    } else {
      grad.addColorStop(0, "rgba(0,255,150,0.35)");
      grad.addColorStop(1, "rgba(0,255,150,0.01)");
    }

    ctx.beginPath();
    ctx.moveTo(toX(0), H - padB);
    history.forEach((m, i) => ctx.lineTo(toX(i), toY(m)));
    ctx.lineTo(toX(history.length - 1), H - padB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Curve line
    ctx.beginPath();
    history.forEach((m, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(m));
      else ctx.lineTo(toX(i), toY(m));
    });
    ctx.strokeStyle = gamePhase === "crashed" ? "#ff3c3c" : "#00ff96";
    ctx.lineWidth = 3;
    ctx.shadowColor = gamePhase === "crashed" ? "#ff3c3c" : "#00ff96";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Plane emoji at tip
    const lastX = toX(history.length - 1);
    const lastY = toY(history[history.length - 1]);
    ctx.font = "28px serif";
    ctx.textAlign = "center";
    if (gamePhase === "crashed") {
      ctx.save();
      ctx.translate(lastX, lastY);
      ctx.rotate(Math.PI / 4);
      ctx.fillText("✈️", 0, 0);
      ctx.restore();
    } else {
      ctx.fillText("✈️", lastX, lastY - 8);
    }

    // Y-axis labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    for (let m = 1; m <= Math.ceil(maxM); m += Math.ceil(maxM / 5)) {
      const y = toY(m);
      if (y > 10 && y < H - padB) {
        ctx.fillText(`${m.toFixed(1)}x`, padL - 5, y + 4);
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={320}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
