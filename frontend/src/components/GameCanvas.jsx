import { useEffect, useRef } from "react";

export default function GameCanvas({ multiplier, gamePhase }) {
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const planeImageRef = useRef(new Image());

  useEffect(() => {
    planeImageRef.current.src = "/plane.png";
    planeImageRef.current.onload = () => draw();
  }, []);

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

    // Background
    const bg = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.5, H * 0.5, W * 0.8);
    bg.addColorStop(0, "#2a1a4e");
    bg.addColorStop(0.5, "#1a1035");
    bg.addColorStop(1, "#0d0820");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Radial lines
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
    const padL = 40, padB = 40, padR = 40, padT = 40;
    const drawW = W - padL - padR;
    const drawH = H - padB - padT;

    function toX(i) { return padL + (i / (history.length - 1)) * drawW; }
    function toY(m) {
      const norm = Math.log(m) / Math.log(maxM);
      return H - padB - norm * drawH;
    }

    // Draw Fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(padL, H - padB);
    history.forEach((m, i) => {
      if (i === 0) ctx.lineTo(toX(i), toY(m));
      else {
        const xc = (toX(i) + toX(i - 1)) / 2;
        const yc = (toY(m) + toY(history[i - 1])) / 2;
        ctx.quadraticCurveTo(toX(i - 1), toY(history[i - 1]), xc, yc);
      }
    });
    ctx.lineTo(toX(history.length - 1), toY(history[history.length - 1]));
    ctx.lineTo(toX(history.length - 1), H - padB);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, padT, 0, H - padB);
    fillGrad.addColorStop(0, gamePhase === "crashed" ? "rgba(220,30,30,0.4)" : "rgba(232,0,61,0.4)");
    fillGrad.addColorStop(1, "rgba(13,8,32,0)");
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.restore();

    // Draw Curve
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(history[0]));
    for (let i = 1; i < history.length; i++) {
      const xc = (toX(i) + toX(i - 1)) / 2;
      const yc = (toY(history[i]) + toY(history[i - 1])) / 2;
      ctx.quadraticCurveTo(toX(i - 1), toY(history[i - 1]), xc, yc);
    }
    ctx.lineTo(toX(history.length - 1), toY(history[history.length - 1]));
    ctx.strokeStyle = gamePhase === "crashed" ? "#ff1744" : "#e8003d";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();

    // Draw Plane
    const lastX = toX(history.length - 1);
    const lastY = toY(history[history.length - 1]);
    const planeImg = planeImageRef.current;
    
    let rotation = 0;
    if (history.length >= 2) {
      const dx = toX(history.length - 1) - toX(history.length - 2);
      const dy = toY(history[history.length - 1]) - toY(history[history.length - 2]);
      rotation = Math.atan2(dy, dx);
    }

    if (planeImg.complete && planeImg.naturalWidth !== 0) {
      ctx.save();
      ctx.translate(lastX, lastY);
      if (gamePhase === "crashed") ctx.rotate(Math.PI / 4);
      else ctx.rotate(rotation);
      ctx.drawImage(planeImg, -25, -25, 50, 50);
      ctx.restore();
    } else {
      // Fallback if image not found
      ctx.save();
      ctx.fillStyle = "#e8003d";
      ctx.font = "30px serif";
      ctx.translate(lastX, lastY);
      ctx.rotate(rotation);
      ctx.fillText("✈", -15, 10);
      ctx.restore();
    }

    if (gamePhase === "crashed") {
      ctx.fillStyle = "rgba(255,23,68,0.9)";
      ctx.font = "bold 24px 'Orbitron', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FLEW AWAY!", W / 2, H / 2);
    }
  }

  return (
    <canvas ref={canvasRef} width={900} height={380}
      style={{ width: "100%", height: "100%", display: "block" }} />
  );
}
