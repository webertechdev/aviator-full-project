// frontend/src/components/GameCanvas.jsx

import { useEffect, useRef, useState } from "react";

import {
  resizeCanvas,
  roundRect,
} from "../utils/canvasUtils";

import {
  sampleCurve,
} from "../utils/curveRenderer";

import { drawBackground } from "../utils/drawBackground";
import { drawCurve } from "../utils/drawCurve";
import { drawPlane } from "../utils/drawPlane";
import { drawCrash } from "../utils/drawCrash";

export default function GameCanvas({

  multiplier,

  gamePhase,

  liveBets = []

}) {
  console.log("GameCanvas Render", {
  multiplier,
  gamePhase
});

  //--------------------------------------------------
  // Canvas
  //--------------------------------------------------

  const canvasRef = useRef(null);

  const animationRef = useRef(null);

  //--------------------------------------------------
  // Plane
  //--------------------------------------------------

  const planeRef = useRef(null);

  const angleRef = useRef(-0.35);

  //--------------------------------------------------
  // History
  //--------------------------------------------------

  const historyRef = useRef([]);

  const startTimeRef = useRef(null);

  //--------------------------------------------------
  // Crash
  //--------------------------------------------------

  const crashRef = useRef({

    active: false,

    frame: 0

  });

  //--------------------------------------------------
  // Live Bets
  //--------------------------------------------------

  const [livePlayers, setLivePlayers] = useState(0);

  const [liveStake, setLiveStake] = useState(0);

  //--------------------------------------------------
  // Load Plane Image
  //--------------------------------------------------

  useEffect(() => {

    const img = new Image();

    img.src = "/images/aviator_plane.png";

    img.onload = () => {

      planeRef.current = img;

      console.log("Plane loaded");

    };

  }, []);

  //--------------------------------------------------
  // Responsive Canvas
  //--------------------------------------------------

  useEffect(() => {

    const canvas = canvasRef.current;

    if (!canvas) return;

    const resize = () => {

      resizeCanvas(canvas);

      renderScene();

    };

    resize();

    window.addEventListener(

      "resize",

      resize

    );

    return () =>

      window.removeEventListener(

        "resize",

        resize

      );

  }, []);

  //--------------------------------------------------
  // Live Bets Counter
  //--------------------------------------------------

  useEffect(() => {

    const pending = liveBets.filter(

      bet => bet.result === "pending"

    );

    setLivePlayers(

      pending.length

    );

    setLiveStake(

      pending.reduce(

        (sum, bet) =>

          sum + (bet.stake || 0),

        0

      )

    );

  }, [liveBets]);

  //--------------------------------------------------
  // Game State
  //--------------------------------------------------

  useEffect(() => {

    cancelAnimationFrame(

      animationRef.current

    );

   if (gamePhase === "waiting") {

      historyRef.current = [

          {

              t: 0,

              m: 1

          }

      ];

      startTimeRef.current = performance.now();

      crashRef.current = {

        active: false,

        frame: 0

      };

      renderScene();

      return;

    }

    if (gamePhase === "flying") {

    if (historyRef.current.length === 0) {

        startTimeRef.current = performance.now();

    }

    historyRef.current.push({

        t: (performance.now() - startTimeRef.current) / 1000,

        m: multiplier

    });

    if (historyRef.current.length > 250) {

        historyRef.current.shift();

    }

    renderScene();

    return;

}

    if (gamePhase === "crashed") {

      if (!crashRef.current.active) {

        crashRef.current.active = true;

        crashRef.current.frame = 0;

      }

      animateCrash();

    }

  }, [

    multiplier,

    gamePhase

  ]);

  //--------------------------------------------------
  // Crash Animation
  //--------------------------------------------------

  function animateCrash() {

    const animate = () => {

      crashRef.current.frame++;

      renderScene();

      if (

        crashRef.current.frame < 55

      ) {

        animationRef.current =

          requestAnimationFrame(

            animate

          );

      }

    };

    animationRef.current =

      requestAnimationFrame(

        animate

      );

  }

  //--------------------------------------------------
  // Main Renderer
  //--------------------------------------------------

  function renderScene() {

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const W = canvas.width;

    const H = canvas.height;

    ctx.clearRect(

      0,

      0,

      W,

      H

    );

    drawBackground(

      ctx,

      W,

      H

    );
    //--------------------------------------------------
    // Waiting Screen
    //--------------------------------------------------

    if (gamePhase === "waiting") {

      ctx.save();

      ctx.globalAlpha =
        0.75 + Math.sin(Date.now() / 300) * 0.25;

      ctx.beginPath();

      ctx.arc(
        W / 2,
        H / 2 - 18,
        46,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle = "#ff1d4d";
      ctx.lineWidth = 2;

      ctx.stroke();

      ctx.globalAlpha = 1;

      ctx.fillStyle = "#ffffff";

      ctx.font = "bold 15px Orbitron";

      ctx.textAlign = "center";

      ctx.fillText(
        "PREPARING NEXT ROUND",
        W / 2,
        H / 2 - 5
      );

      ctx.restore();

    } else {

      //--------------------------------------------------
      // Build Curve
      //--------------------------------------------------

      console.log("History:", historyRef.current.length);
      
      console.log("Phase:", gamePhase);
      console.log("Multiplier:", multiplier);
      
      const points = sampleCurve(
        historyRef.current,
        W,
        H
      );
      
      drawCurve(
        ctx,
        points,
        W,
        H,
        gamePhase
      );

      //--------------------------------------------------
      // Draw Plane
      //--------------------------------------------------

      const elapsed =

        startTimeRef.current

          ? (Date.now() - startTimeRef.current) / 1000

          : 0;

      drawPlane(

        ctx,

        planeRef.current,

        points,

        angleRef,

        elapsed,

        gamePhase

      );

      //--------------------------------------------------
      // Crash Explosion
      //--------------------------------------------------

      if (

        gamePhase === "crashed" &&

        points.length

      ) {

        const last =

          points[points.length - 1];

        drawCrash(

          ctx,

          last.x,

          last.y,

          crashRef.current.frame,

          multiplier

        );

      }

    }

    //--------------------------------------------------
    // Live Counter
    //--------------------------------------------------

    if (

      gamePhase === "flying" &&

      livePlayers > 0

    ) {

      ctx.save();

      ctx.fillStyle =

        "rgba(0,0,0,.45)";

      roundRect(

        ctx,

        W - 180,

        12,

        165,

        56,

        8

      );

      ctx.fill();

      ctx.strokeStyle =

        "rgba(0,255,120,.25)";

      ctx.stroke();

      ctx.fillStyle = "#00ff7a";

      ctx.font =

        "bold 11px Orbitron";

      ctx.fillText(

        `${livePlayers} PLAYERS`,

        W - 165,

        32

      );

      ctx.fillStyle = "#ffd84a";

      ctx.font = "10px Inter";

      ctx.fillText(

        `${liveStake.toLocaleString()} KES`,

        W - 165,

        50

      );

      ctx.restore();

    }

  }

  //--------------------------------------------------
  // Cleanup
  //--------------------------------------------------

  useEffect(() => {

    return () => {

      cancelAnimationFrame(

        animationRef.current

      );

    };

  }, []);
  console.log(historyRef.current.slice(-10));

  //--------------------------------------------------
  // Component
  //--------------------------------------------------

  return (

    <canvas

      ref={canvasRef}

      style={{

        width: "100%",

        height: "100%",

        display: "block"

      }}

    />

  );

}