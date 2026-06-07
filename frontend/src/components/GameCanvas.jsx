import { useEffect, useRef } from "react";

export default function GameCanvas({ multiplier, gamePhase }) {
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const planeRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (gamePhase === "waiting") historyRef.current = [];
    if (gamePhase === "flying" || gamePhase === "crashed") {
      historyRef.current.push(multiplier);
    }
    draw();
  }, [multiplier, gamePhase]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background — dark purple gradient like Betika
    const bg = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.5, H * 0.5, W * 0.8);
    bg.addColorStop(0, "#2a1a4e");
    bg.addColorStop(0.5, "#1a1035");
    bg.addColorStop(1, "#0d0820");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Radial lines (Betika style)
    ctx.save();
    ctx.globalAlpha = 0.08;
    const cx = W * 0.5, cy = H * 0.85;
    for (let a = -80; a <= 80; a += 8) {
      const rad = (a * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(rad) * W * 1.5, cy - Math.cos(rad) * H * 1.5);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.restore();

    if (gamePhase === "waiting") {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "bold 18px 'Orbitron', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for next round...", W / 2, H / 2);
      return;
    }

    const history = historyRef.current;
    if (history.length < 2) return;

    const maxM = Math.max(...history, 2);
    const padL = 30, padB = 30, padR = 30, padT = 20;
    const drawW = W - padL - padR;
    const drawH = H - padB - padT;

    function toX(i) { return padL + (i / (history.length - 1)) * drawW; }
    function toY(m) {
      const norm = Math.log(m) / Math.log(maxM);
      return H - padB - norm * drawH;
    }

    const lastX = toX(history.length - 1);
    const lastY = toY(history[history.length - 1]);
    planeRef.current = { x: lastX, y: lastY };

    // Fill under curve
    ctx.beginPath();
    ctx.moveTo(padL, H - padB);
    history.forEach((m, i) => ctx.lineTo(toX(i), toY(m)));
    ctx.lineTo(lastX, H - padB);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, padT, 0, H - padB);
    if (gamePhase === "crashed") {
      fillGrad.addColorStop(0, "rgba(220,30,30,0.5)");
      fillGrad.addColorStop(1, "rgba(180,20,20,0.05)");
    } else {
      fillGrad.addColorStop(0, "rgba(220,30,80,0.45)");
      fillGrad.addColorStop(1, "rgba(180,10,40,0.05)");
    }
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Curve line
    ctx.beginPath();
    history.forEach((m, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(m));
      else ctx.lineTo(toX(i), toY(m));
    });
    ctx.strokeStyle = gamePhase === "crashed" ? "#cc0000" : "#e8003d";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Plane (red ✈ like Betika)
    if (gamePhase !== "crashed") {
      ctx.save();
      ctx.font = "28px serif";
      ctx.fillStyle = "#e8003d";
      ctx.shadowColor = "#ff0044";
      ctx.shadowBlur = 20;
      // Slight angle based on curve direction
      if (history.length >= 3) {
        const dy = toY(history[history.length - 1]) - toY(history[history.length - 3]);
        const dx = toX(history.length - 1) - toX(history.length - 3);
        ctx.translate(lastX, lastY - 14);
        ctx.rotate(Math.atan2(dy, dx) - 0.2);
        ctx.scale(-1, 1);
        ctx.fillText("✈", -14, 0);
      } else {
        ctx.fillText("✈", lastX, lastY - 14);
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = "28px serif";
      ctx.translate(lastX, lastY);
      ctx.rotate(Math.PI / 3);
      ctx.fillText("✈", -14, 0);
      ctx.restore();
    }

    // FLEW AWAY text on crash
    if (gamePhase === "crashed") {
      ctx.fillStyle = "rgba(220,30,30,0.9)";
      ctx.font = "bold 16px 'Orbitron', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FLEW AWAY!", W / 2, H / 2 - 10);
    }
  }

  return (
    <canvas ref={canvasRef} width={900} height={380}
      style={{ width: "100%", height: "100%", display: "block" }} />
  );
}
