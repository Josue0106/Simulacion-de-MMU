"use client";

import React, { useState, useEffect, useRef } from "react";
import { SimuladorInstancia } from "./engine/engine.js";
import { parsearInstrucciones } from "./engine/core/parser.js";
import { generarOperaciones } from "./engine/core/generator.js";

type AlgorithmType = "FIFO" | "SC" | "LRU" | "LFU";

interface RamFrame {
  frameIndex: number;
  occupied: boolean;
  pageId: number;
  pid: number;
  ptrId: number;
}

interface PageRow {
  pageId: number;
  pid: number;
  loaded: boolean;
  lAddr: number;
  mAddr: number | string;
  dAddr: number | string;
  loadedT: string;
  mark: string;
}

interface SimMetrics {
  ram: RamFrame[];
  pages: PageRow[];
  processesCount: number;
  totalProcessesSeen: number;
  simTime: number;
  ramKb: number;
  ramPercent: number;
  vramKb: number;
  vramPercent: number;
  loadedPages: number;
  unloadedPages: number;
  thrashingTime: number;
  thrashingPercent: number;
  fragmentacionKb: number;
  fragmentacionBytes: number;
}

interface ParsedInstruction {
  type: string;
  raw: string;
  pid?: number;
  size?: number;
  ptr_id?: number;
}

// Paleta de colores pastel suaves estilo hoja de cálculo (como el Anexo 2)
const PID_COLORS = [
  "#c6efce", // Verde claro (PID 1)
  "#ffeb9c", // Amarillo pastel (PID 2)
  "#ffc7ce", // Rosa claro (PID 3)
  "#b4c6e7", // Azul pastel (PID 4)
  "#f8cbad", // Naranja durazno (PID 5)
  "#e2efda", // Verde menta (PID 6)
  "#d9e1f2", // Lavanda azulado (PID 7)
  "#fce4d6", // Salmón claro (PID 8)
  "#ededed", // Gris suave (PID 9)
  "#fff2cc", // Crema (PID 10)
  "#d0cece", // Plata suave
  "#ddebf7", // Celeste claro
];

function getPidColor(pid: number): string {
  if (!pid || pid < 1) return "#ffffff";
  return PID_COLORS[(pid - 1) % PID_COLORS.length];
}

const ANEXO_1_EXAMPLE = `new(1,500)
use(1)
new(1,1000)
use(1)
use(2)
new(2,500)
use(3)
use(1)
new(2,50)
use(4)
delete(1)
use(2)
use(3)
delete(2)
kill(1)
kill(2)`;

export default function MmuSimulatorPage() {
  // Vista activa: "prep" (Preparación) o "sim" (Simulación)
  const [view, setView] = useState<"prep" | "sim">("prep");

  // Parámetros de Preparación
  const [seed, setSeed] = useState<string>("2026");
  const [algorithm, setAlgorithm] = useState<AlgorithmType>("LRU");
  const [processCount, setProcessCount] = useState<number>(10);
  const [operationCount, setOperationCount] = useState<number>(500);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [operationsText, setOperationsText] = useState<string>("");
  const [isUsingFile, setIsUsingFile] = useState<boolean>(false);

  // Estado de Simulación
  const [parsedInstructions, setParsedInstructions] = useState<ParsedInstruction[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(80);
  const [optMetrics, setOptMetrics] = useState<SimMetrics | null>(null);
  const [algMetrics, setAlgMetrics] = useState<SimMetrics | null>(null);
  const [lastInstruction, setLastInstruction] = useState<string>("-");

  const optSimRef = useRef<SimuladorInstancia | null>(null);
  const algSimRef = useRef<SimuladorInstancia | null>(null);

  // Generar automáticamente operaciones cuando cambian seed, P o N (si no hay archivo cargado)
  useEffect(() => {
    if (!isUsingFile) {
      const generated = generarOperaciones(seed, processCount, operationCount);
      setOperationsText(generated);
    }
  }, [seed, processCount, operationCount, isUsingFile]);

  // Manejo de carga de archivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || "");
      setOperationsText(content);
      setUploadedFileName(file.name);
      setIsUsingFile(true);
    };
    reader.readAsText(file);
  };

  const handleClearFile = () => {
    setUploadedFileName("");
    setIsUsingFile(false);
    const generated = generarOperaciones(seed, processCount, operationCount);
    setOperationsText(generated);
  };

  const handleLoadAnexo1 = () => {
    setUploadedFileName("anexo1_ejemplo.txt");
    setIsUsingFile(true);
    setOperationsText(ANEXO_1_EXAMPLE);
  };

  const handleRegenerate = () => {
    setIsUsingFile(false);
    setUploadedFileName("");
    const generated = generarOperaciones(seed, processCount, operationCount);
    setOperationsText(generated);
  };

  // Descargar archivo de operaciones compatible con Anexo 1
  const handleDownloadOperations = () => {
    const blob = new Blob([operationsText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = uploadedFileName || `operaciones_P${processCount}_N${operationCount}_seed${seed}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Iniciar la ventana de Simulación
  const startSimulationWindow = () => {
    const parsed = parsearInstrucciones(operationsText) as ParsedInstruction[];
    if (parsed.length === 0) {
      alert("No hay instrucciones válidas para simular.");
      return;
    }

    const optSim = new SimuladorInstancia(parsed, "OPT");
    const userSim = new SimuladorInstancia(parsed, algorithm);

    optSimRef.current = optSim;
    algSimRef.current = userSim;

    setParsedInstructions(parsed);
    setCurrentStep(0);
    setLastInstruction("Listo para iniciar");
    setOptMetrics(optSim.getMetrics());
    setAlgMetrics(userSim.getMetrics());
    setView("sim");
    setIsRunning(true);
  };

  // Ejecutar un paso coordinado en ambos algoritmos
  const executeSingleStep = () => {
    const optSim = optSimRef.current;
    const userSim = algSimRef.current;
    if (!optSim || !userSim) return false;

    const hasMoreOpt = optSim.step();
    const hasMoreAlg = userSim.step();

    if (hasMoreOpt || hasMoreAlg) {
      setOptMetrics(optSim.getMetrics());
      setAlgMetrics(userSim.getMetrics());
      setCurrentStep(optSim.indiceActual);
      setLastInstruction(optSim.ultimaInstruccion?.raw || "-");
      if (optSim.indiceActual >= parsedInstructions.length) {
        setIsRunning(false);
        return false;
      }
      return true;
    } else {
      setIsRunning(false);
      return false;
    }
  };

  // Ejecutar hasta el final de inmediato
  const executeAllRemaining = () => {
    const optSim = optSimRef.current;
    const userSim = algSimRef.current;
    if (!optSim || !userSim) return;

    setIsRunning(false);
    while (optSim.step() && userSim.step()) {
      // Avanza coordinadamente hasta terminar
    }
    setOptMetrics(optSim.getMetrics());
    setAlgMetrics(userSim.getMetrics());
    setCurrentStep(optSim.indiceActual);
    setLastInstruction(optSim.ultimaInstruccion?.raw || "Simulación finalizada");
  };

  // Reiniciar la simulación actual desde 0
  const resetSimulation = () => {
    setIsRunning(false);
    const optSim = new SimuladorInstancia(parsedInstructions, "OPT");
    const userSim = new SimuladorInstancia(parsedInstructions, algorithm);
    optSimRef.current = optSim;
    algSimRef.current = userSim;
    setCurrentStep(0);
    setLastInstruction("Reiniciado");
    setOptMetrics(optSim.getMetrics());
    setAlgMetrics(userSim.getMetrics());
  };

  // Loop de animación coordinada
  useEffect(() => {
    if (!isRunning || view !== "sim") return;

    const timer = setInterval(() => {
      const keepGoing = executeSingleStep();
      if (!keepGoing) {
        clearInterval(timer);
      }
    }, speedMs);

    return () => clearInterval(timer);
  }, [isRunning, view, speedMs, parsedInstructions]);

  const parsedPreviewCount = operationsText
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#") && !l.trim().startsWith("//")).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      {/* Barra superior del Simulador */}
      <header className="bg-slate-900 text-white px-6 py-3 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
          <h1 className="text-lg font-bold tracking-wide">
            Simulador de Unidad de Gestión de Memoria (MMU) — OPT vs {algorithm}
          </h1>
        </div>
        <div className="text-xs text-slate-300 flex items-center gap-4">
          <span>RAM: 400 KB (100 páginas × 4 KB)</span>
          <span>•</span>
          <span>Hit: +1s | Fallo: +5s (Thrashing)</span>
          {view === "sim" && (
            <button
              onClick={() => {
                setIsRunning(false);
                setView("prep");
              }}
              className="ml-2 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-medium transition cursor-pointer"
            >
              ← Volver a Preparación
            </button>
          )}
        </div>
      </header>

      {view === "prep" ? (
        /* ==================== VENTANA 1: PREPARACIÓN ==================== */
        <main className="max-w-5xl mx-auto p-6 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5">
              1. Configuración y Preparación del Escenario
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna Izquierda: Controles */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Semilla para Random (permite repetir el escenario)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={seed}
                      onChange={(e) => {
                        setIsUsingFile(false);
                        setSeed(e.target.value);
                      }}
                      placeholder="Ej. 2026"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsUsingFile(false);
                        setSeed(String(Math.floor(Math.random() * 90000) + 10000));
                      }}
                      className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 cursor-pointer"
                    >
                      Semilla Aleatoria
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Algoritmo a Simular (comparado en simultáneo con OPT)
                  </label>
                  <select
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="FIFO">FIFO (First-In, First-Out)</option>
                    <option value="SC">SC (Second Chance)</option>
                    <option value="LRU">LRU (Least Recently Used)</option>
                    <option value="LFU">LFU (Least Frequently Used)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Número de Procesos (P)
                    </label>
                    <select
                      value={processCount}
                      disabled={isUsingFile}
                      onChange={(e) => setProcessCount(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value={10}>10 procesos</option>
                      <option value={50}>50 procesos</option>
                      <option value={100}>100 procesos</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Cantidad de Operaciones (N)
                    </label>
                    <select
                      value={operationCount}
                      disabled={isUsingFile}
                      onChange={(e) => setOperationCount(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value={500}>500 operaciones</option>
                      <option value={1000}>1000 operaciones</option>
                      <option value={5000}>5000 operaciones</option>
                    </select>
                  </div>
                </div>

                {/* Archivo para simular */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Archivo para Simular (Opcional)
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Si no provee un archivo, el sistema genera automáticamente {operationCount} operaciones para {processCount} procesos usando la semilla indicada.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg cursor-pointer transition">
                      Cargar Archivo (.txt)
                      <input
                        type="file"
                        accept=".txt,.ops,text/plain"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleLoadAnexo1}
                      className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 cursor-pointer"
                    >
                      Cargar Ejemplo Anexo 1
                    </button>
                    {isUsingFile && (
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="px-3 py-2 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 cursor-pointer"
                      >
                        Quitar archivo y usar generador
                      </button>
                    )}
                  </div>
                  {uploadedFileName && (
                    <p className="mt-2 text-xs text-emerald-700 font-medium">
                      Archivo activo: {uploadedFileName}
                    </p>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Previsualización y Descarga de Operaciones */}
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-slate-700">
                    Secuencia de Instrucciones ({parsedPreviewCount} operaciones)
                  </label>
                  <div className="flex gap-2">
                    {!isUsingFile && (
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 cursor-pointer"
                      >
                        Regenerar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadOperations}
                      className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs cursor-pointer"
                    >
                      ⬇ Descargar Archivo (.txt)
                    </button>
                  </div>
                </div>

                <textarea
                  value={operationsText}
                  onChange={(e) => {
                    setIsUsingFile(true);
                    setUploadedFileName("editado_manualmente.txt");
                    setOperationsText(e.target.value);
                  }}
                  rows={12}
                  spellCheck={false}
                  className="w-full flex-1 font-mono text-xs rounded-lg border border-slate-300 p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Formato compatible con Anexo 1: <code>new(pid,size)</code>, <code>use(ptr)</code>, <code>delete(ptr)</code>, <code>kill(pid)</code>.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={startSimulationWindow}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-sm transition cursor-pointer"
              >
                Iniciar Simulación (OPT vs {algorithm}) →
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* ==================== VENTANA 2: SIMULACIÓN ==================== */
        <main className="max-w-[1600px] mx-auto p-4 space-y-4">
          {/* Panel de Control de Ejecución (Pausar / Reanudar / Paso / Velocidad) */}
          <div className="bg-white rounded-lg shadow-xs border border-slate-300 p-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRunning((prev) => !prev)}
                disabled={currentStep >= parsedInstructions.length}
                className={`px-4 py-1.5 rounded font-bold text-xs text-white transition cursor-pointer disabled:opacity-50 ${
                  isRunning ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isRunning ? "⏸ Pausar" : "▶ Reanudar"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRunning(false);
                  executeSingleStep();
                }}
                disabled={isRunning || currentStep >= parsedInstructions.length}
                className="px-3 py-1.5 rounded font-semibold text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 disabled:opacity-50 cursor-pointer"
              >
                ⏭ Paso (+1 op)
              </button>

              <button
                type="button"
                onClick={executeAllRemaining}
                disabled={currentStep >= parsedInstructions.length}
                className="px-3 py-1.5 rounded font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
              >
                ⏩ Completar Todo
              </button>

              <button
                type="button"
                onClick={resetSimulation}
                className="px-3 py-1.5 rounded font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer"
              >
                ↺ Reiniciar
              </button>

              <button
                type="button"
                onClick={handleDownloadOperations}
                className="px-3 py-1.5 rounded font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer"
              >
                ⬇ Descargar Operaciones
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Velocidad:</span>
                <select
                  value={speedMs}
                  onChange={(e) => setSpeedMs(Number(e.target.value))}
                  className="border border-slate-300 rounded px-2 py-1 bg-white"
                >
                  <option value={500}>Lenta (500ms)</option>
                  <option value={150}>Normal (150ms)</option>
                  <option value={50}>Rápida (50ms)</option>
                  <option value={10}>Turbo (10ms)</option>
                </select>
              </div>

              <div className="bg-slate-100 px-3 py-1 rounded border border-slate-300 font-mono">
                Operación:{" "}
                <strong className="text-blue-700">
                  {currentStep} / {parsedInstructions.length}
                </strong>{" "}
                | Actual: <strong className="text-slate-900">{lastInstruction}</strong>
              </div>
            </div>
          </div>

          {/* Barras Superiores de Estado de la RAM (100 páginas cada una, idénticas al Anexo 2) */}
          <div className="bg-white rounded-lg shadow-xs border border-slate-300 p-4 space-y-3">
            {/* RAM - OPT */}
            <div>
              <div className="border border-black text-center font-bold text-xs py-1 bg-white">
                RAM - OPT
              </div>
              <div
                className="grid border-x border-b border-black"
                style={{ gridTemplateColumns: "repeat(100, minmax(0, 1fr))" }}
              >
                {optMetrics?.ram.map((frame) => (
                  <div
                    key={frame.frameIndex}
                    title={
                      frame.occupied
                        ? `Marco ${frame.frameIndex} | Página ${frame.pageId} | PID ${frame.pid} | Puntero ${frame.ptrId}`
                        : `Marco ${frame.frameIndex} (Libre)`
                    }
                    className="h-5 border-r border-black last:border-r-0 transition-colors"
                    style={{
                      backgroundColor: frame.occupied ? getPidColor(frame.pid) : "#ffffff",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* RAM - [ALG] */}
            <div>
              <div className="border border-black text-center font-bold text-xs py-1 bg-white">
                RAM - {algorithm}
              </div>
              <div
                className="grid border-x border-b border-black"
                style={{ gridTemplateColumns: "repeat(100, minmax(0, 1fr))" }}
              >
                {algMetrics?.ram.map((frame) => (
                  <div
                    key={frame.frameIndex}
                    title={
                      frame.occupied
                        ? `Marco ${frame.frameIndex} | Página ${frame.pageId} | PID ${frame.pid} | Puntero ${frame.ptrId}`
                        : `Marco ${frame.frameIndex} (Libre)`
                    }
                    className="h-5 border-r border-black last:border-r-0 transition-colors"
                    style={{
                      backgroundColor: frame.occupied ? getPidColor(frame.pid) : "#ffffff",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Paneles Comparativos Lado a Lado: MMU - OPT vs MMU - [ALG] */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {optMetrics && <AlgorithmPanel title="MMU - OPT" metrics={optMetrics} />}
            {algMetrics && <AlgorithmPanel title={`MMU - ${algorithm}`} metrics={algMetrics} />}
          </div>
        </main>
      )}
    </div>
  );
}

function AlgorithmPanel({ title, metrics }: { title: string; metrics: SimMetrics }) {
  const isHighThrashing = metrics.thrashingPercent > 50;

  return (
    <div className="bg-white rounded-lg shadow-xs border border-slate-300 p-4 space-y-4">
      {/* Tabla MMU con scroll vertical fijo */}
      <div className="border border-black">
        <div className="text-center font-bold text-xs py-1 border-b border-black bg-white">
          {title}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          <table className="w-full border-collapse text-center text-xs">
            <thead className="sticky top-0 bg-white border-b border-black z-10">
              <tr className="font-bold">
                <th className="border-r border-black py-1 px-1">PAGE ID</th>
                <th className="border-r border-black py-1 px-1">PID</th>
                <th className="border-r border-black py-1 px-1">LOADED</th>
                <th className="border-r border-black py-1 px-1">L-ADDR</th>
                <th className="border-r border-black py-1 px-1">M-ADDR</th>
                <th className="border-r border-black py-1 px-1">D-ADDR</th>
                <th className="border-r border-black py-1 px-1">LOADED-T</th>
                <th className="py-1 px-1">MARK</th>
              </tr>
            </thead>
            <tbody>
              {metrics.pages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-slate-400">
                    Sin páginas activas en la MMU
                  </td>
                </tr>
              ) : (
                metrics.pages.map((p) => (
                  <tr
                    key={p.pageId}
                    style={{ backgroundColor: getPidColor(p.pid) }}
                    className="border-b border-black/40"
                  >
                    <td className="border-r border-black/40 py-0.5 px-1">{p.pageId}</td>
                    <td className="border-r border-black/40 py-0.5 px-1">{p.pid}</td>
                    <td className="border-r border-black/40 py-0.5 px-1 font-bold">
                      {p.loaded ? "X" : ""}
                    </td>
                    <td className="border-r border-black/40 py-0.5 px-1">{p.lAddr}</td>
                    <td className="border-r border-black/40 py-0.5 px-1">{p.mAddr}</td>
                    <td className="border-r border-black/40 py-0.5 px-1">{p.dAddr}</td>
                    <td className="border-r border-black/40 py-0.5 px-1">{p.loadedT}</td>
                    <td className="py-0.5 px-1">{p.mark}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tablas de Estadísticas Inferiores (idénticas al Anexo 2) */}
      <div className="space-y-3 text-xs">
        {/* Processes & Sim-Time */}
        <table className="w-full border-collapse border border-black text-center">
          <thead>
            <tr className="border-b border-black bg-slate-50 font-semibold">
              <th className="border-r border-black py-1 w-1/2">Processes</th>
              <th className="py-1 w-1/2">Sim-Time</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-r border-black py-2 text-sm font-medium">
                {metrics.processesCount}
              </td>
              <td className="py-2 text-sm font-medium">{metrics.simTime}s</td>
            </tr>
          </tbody>
        </table>

        {/* RAM KB | RAM % | V-RAM KB | V-RAM % */}
        <table className="w-full border-collapse border border-black text-center">
          <thead>
            <tr className="border-b border-black bg-slate-50 font-semibold">
              <th className="border-r border-black py-1 w-1/4">RAM KB</th>
              <th className="border-r border-black py-1 w-1/4">RAM %</th>
              <th className="border-r border-black py-1 w-1/4">V-RAM KB</th>
              <th className="py-1 w-1/4">V-RAM %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-r border-black py-1.5">{metrics.ramKb}</td>
              <td className="border-r border-black py-1.5">{metrics.ramPercent}%</td>
              <td className="border-r border-black py-1.5">{metrics.vramKb}</td>
              <td className="py-1.5">{metrics.vramPercent}%</td>
            </tr>
          </tbody>
        </table>

        {/* PAGES (LOADED / UNLOADED) | Thrashing (s / %) | Fragmentación */}
        <table className="w-full border-collapse border border-black text-center">
          <thead>
            <tr className="border-b border-black bg-slate-50 font-semibold">
              <th colSpan={2} className="border-r border-black py-1 w-2/5">
                PAGES
              </th>
              <th
                colSpan={2}
                className={`border-r border-black py-1 w-2/5 ${
                  isHighThrashing ? "bg-red-200 text-red-900 font-bold" : ""
                }`}
              >
                Thrashing
              </th>
              <th className="py-1 w-1/5">Fragmentación</th>
            </tr>
            <tr className="border-b border-black bg-slate-50 text-[11px]">
              <th className="border-r border-black py-0.5 w-1/5">LOADED</th>
              <th className="border-r border-black py-0.5 w-1/5">UNLOADED</th>
              <th
                colSpan={2}
                className={`border-r border-black py-0.5 ${
                  isHighThrashing ? "bg-red-200" : ""
                }`}
              />
              <th className="py-0.5" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-r border-black py-1.5">{metrics.loadedPages}</td>
              <td className="border-r border-black py-1.5">{metrics.unloadedPages}</td>
              <td
                className={`border-r border-black py-1.5 w-1/5 ${
                  isHighThrashing ? "bg-red-200 text-red-700 font-bold" : ""
                }`}
              >
                {metrics.thrashingTime}s
              </td>
              <td
                className={`border-r border-black py-1.5 w-1/5 ${
                  isHighThrashing ? "bg-red-200 text-red-700 font-bold" : ""
                }`}
              >
                {metrics.thrashingPercent}%
              </td>
              <td className="py-1.5">{metrics.fragmentacionKb}KB</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

