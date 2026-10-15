import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Calculator,
  CheckSquare,
  ChevronRight,
  Image,
  IndianRupee,
  Plus,
  Ruler,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  calculateAgeDetails,
  estimateMonthlySalary,
  evaluateAgeLimits,
  validateDimensions,
  validateOfficialSource,
} from "./tool-calculations";
import { documentRuleSets, feeRuleSets, photoPresets, salaryConfig } from "./tool-config";
import { ToolField, ToolPanel, buttonClass, inputClass, secondaryButtonClass } from "./ToolComponents";
import { ToolLayout } from "./ToolLayout";
import { toolCopy, type ToolLanguage } from "./tool-copy";

function useToolText() {
  const { i18n } = useTranslation();
  const language: ToolLanguage = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";
  return { language, text: toolCopy[language] };
}

const toolCards = [
  { path: "/tools/photo-resizer", icon: Image, title: "photo", description: "photoDescription" },
  { path: "/tools/age-calculator", icon: Calculator, title: "age", description: "ageDescription" },
  { path: "/tools/salary-estimator", icon: IndianRupee, title: "salary", description: "salaryDescription" },
  { path: "/tools/document-checklist", icon: CheckSquare, title: "documents", description: "documentsDescription" },
  { path: "/tools/fee-calculator", icon: IndianRupee, title: "fees", description: "feesDescription" },
] as const;

export function ToolsIndexPage() {
  const { text } = useToolText();
  return (
    <ToolLayout pageId="tools" title={text.toolsTitle} description={text.toolsIntro}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {toolCards.map(({ path, icon: Icon, title, description }) => (
          <Link
            key={path}
            to={path}
            className="group rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-forest/30 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-mint text-forest">
              <Icon size={21} aria-hidden="true" />
            </span>
            <h2 className="mt-4 flex items-center justify-between text-lg font-bold">
              {text[title]}
              <ChevronRight size={18} aria-hidden="true" className="text-muted transition group-hover:translate-x-1 group-hover:text-forest" />
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">{text[description]}</p>
          </Link>
        ))}
      </div>
    </ToolLayout>
  );
}

type PhotoFormat = "image/jpeg" | "image/png" | "image/webp";

function blobFromCanvas(canvas: HTMLCanvasElement, type: PhotoFormat, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function PhotoResizerPage() {
  const { language, text } = useToolText();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("image");
  const [presetId, setPresetId] = useState("custom");
  const [width, setWidth] = useState("600");
  const [height, setHeight] = useState("600");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [format, setFormat] = useState<PhotoFormat>("image/jpeg");
  const [targetKb, setTargetKb] = useState("");
  const [output, setOutput] = useState<Blob | null>(null);
  const [targetMet, setTargetMet] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sourceUrl) return;
    const nextImage = new window.Image();
    nextImage.onload = () => {
      setImage(nextImage);
      setError("");
    };
    nextImage.onerror = () => {
      setImage(null);
      setError(text.invalidImage);
    };
    nextImage.src = sourceUrl;
  }, [sourceUrl, text.invalidImage]);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      setOutput(null);
      return;
    }
    const outputWidth = Number(width);
    const outputHeight = Number(height);
    if (validateDimensions(outputWidth, outputHeight)) {
      setOutput(null);
      setError(text.dimensionError);
      return;
    }
    setError("");
    const ratio = outputWidth / outputHeight;
    let cropWidth: number;
    let cropHeight: number;
    if (image.width / image.height > ratio) {
      cropHeight = image.height;
      cropWidth = cropHeight * ratio;
    } else {
      cropWidth = image.width;
      cropHeight = cropWidth / ratio;
    }
    cropWidth /= zoom;
    cropHeight /= zoom;
    const sourceX = Math.max(0, Math.min(image.width - cropWidth, ((image.width - cropWidth) * (offsetX + 100)) / 200));
    const sourceY = Math.max(0, Math.min(image.height - cropHeight, ((image.height - cropHeight) * (offsetY + 100)) / 200));
    const previewScale = Math.min(720 / outputWidth, 520 / outputHeight, 1);
    canvas.width = Math.max(1, Math.round(outputWidth * previewScale));
    canvas.height = Math.max(1, Math.round(outputHeight * previewScale));
    const context = canvas.getContext("2d");
    if (!context) {
      setError(text.widthTooLarge);
      return;
    }
    if (format === "image/jpeg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

    let cancelled = false;
    void (async () => {
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = outputWidth;
      outputCanvas.height = outputHeight;
      const outputContext = outputCanvas.getContext("2d");
      if (!outputContext) {
        setError(text.widthTooLarge);
        return;
      }
      if (format === "image/jpeg") {
        outputContext.fillStyle = "#fff";
        outputContext.fillRect(0, 0, outputWidth, outputHeight);
      }
      outputContext.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
      const targetBytes = Number(targetKb) > 0 ? Number(targetKb) * 1024 : null;
      let blob: Blob | null = null;
      let reachedTarget = true;
      if (targetBytes && format !== "image/png") {
        for (let quality = 0.92; quality >= 0.35; quality -= 0.08) {
          blob = await blobFromCanvas(outputCanvas, format, quality);
          if (blob && blob.size <= targetBytes) break;
        }
        reachedTarget = Boolean(blob && blob.size <= targetBytes);
      } else {
        blob = await blobFromCanvas(outputCanvas, format, 0.9);
        if (targetBytes && blob) reachedTarget = blob.size <= targetBytes;
      }
      if (!cancelled) {
        setOutput(blob);
        setTargetMet(reachedTarget);
        setError(blob ? "" : text.widthTooLarge);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [image, width, height, zoom, offsetX, offsetY, format, targetKb, text.dimensionError, text.widthTooLarge]);

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(text.invalidImage);
      event.target.value = "";
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setFileName(file.name.replace(/\.[^.]+$/, "") || "image");
    setImage(null);
    setOutput(null);
    setSourceUrl(URL.createObjectURL(file));
  }

  function onPreset(value: string) {
    setPresetId(value);
    const preset = photoPresets.find(({ id }) => id === value);
    if (preset) {
      setWidth(String(preset.width));
      setHeight(String(preset.height));
    }
  }

  function download() {
    if (!output) return;
    const extension = format === "image/jpeg" ? "jpg" : format === "image/png" ? "png" : "webp";
    const url = URL.createObjectURL(output);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName}-resized.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ToolLayout pageId="photo" title={text.photo} description={text.photoDescription}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
        <ToolPanel>
          <p className="mb-5 rounded-lg bg-mint px-3 py-2 text-sm leading-6 text-forest">{text.localOnly}</p>
          <div className="space-y-5">
            <ToolField id="photo-file" label={text.chooseImage}>
              <input id="photo-file" type="file" accept="image/*" onChange={onFile} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mint file:px-3 file:py-2 file:font-semibold file:text-forest" />
            </ToolField>
            <div className="grid gap-4 sm:grid-cols-2">
              <ToolField id="photo-preset" label={text.preset}>
                <select id="photo-preset" value={presetId} onChange={(event) => onPreset(event.target.value)} className={inputClass}>
                  <option value="custom">{text.custom}</option>
                  {photoPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label} — {text.sample}
                    </option>
                  ))}
                </select>
              </ToolField>
              <ToolField id="photo-width" label={text.width}>
                <input id="photo-width" type="number" min="1" max="10000" value={width} onChange={(event) => { setPresetId("custom"); setWidth(event.target.value); }} className={inputClass} />
              </ToolField>
              <ToolField id="photo-height" label={text.height}>
                <input id="photo-height" type="number" min="1" max="10000" value={height} onChange={(event) => { setPresetId("custom"); setHeight(event.target.value); }} className={inputClass} />
              </ToolField>
              <ToolField id="photo-format" label={text.format}>
                <select id="photo-format" value={format} onChange={(event) => setFormat(event.target.value as PhotoFormat)} className={inputClass}>
                  <option value="image/jpeg">{text.jpeg}</option>
                  <option value="image/png">{text.png}</option>
                  <option value="image/webp">{text.webp}</option>
                </select>
              </ToolField>
            </div>
            {image && (
              <div className="space-y-4">
                <ToolField id="photo-zoom" label={`${text.zoom}: ${zoom.toFixed(1)}×`}>
                  <input id="photo-zoom" type="range" min="1" max="4" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-forest" />
                </ToolField>
                <ToolField id="photo-horizontal" label={text.horizontal}>
                  <input id="photo-horizontal" type="range" min="-100" max="100" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} className="w-full accent-forest" />
                </ToolField>
                <ToolField id="photo-vertical" label={text.vertical}>
                  <input id="photo-vertical" type="range" min="-100" max="100" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} className="w-full accent-forest" />
                </ToolField>
              </div>
            )}
            <ToolField id="photo-target" label={text.targetSize}>
              <input id="photo-target" type="number" min="1" value={targetKb} onChange={(event) => setTargetKb(event.target.value)} className={inputClass} />
            </ToolField>
            {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
            {!error && output && (
              <p role="status" className="text-sm text-muted">
                {text.outputReady} · {(output.size / 1024).toFixed(1)} KB
                {targetKb && !targetMet && <span className="ml-1 font-semibold text-amber-800">{text.targetMissed}</span>}
              </p>
            )}
            <button type="button" onClick={download} disabled={!output} className={buttonClass}>{text.download}</button>
          </div>
        </ToolPanel>
        <ToolPanel>
          <h2 className="mb-4 text-lg font-bold">{text.preview}</h2>
          {image ? (
            <canvas ref={canvasRef} className="mx-auto max-h-[520px] max-w-full rounded-lg border border-line bg-canvas object-contain" aria-label={text.preview} />
          ) : (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-line bg-canvas p-5 text-center text-sm text-muted">{text.noImage}</div>
          )}
          {presetId !== "custom" && <p className="mt-3 text-xs font-semibold text-amber-800">{text.sample}: {language === "en" ? "confirm image requirements in the official notice." : "आधिकारिक सूचना में छवि आवश्यकताओं की पुष्टि करें।"}</p>}
        </ToolPanel>
      </div>
    </ToolLayout>
  );
}

const categoryKeys = ["categorySc", "categorySt", "categoryObc", "categoryEws", "categoryPwd", "categoryEx", "categoryOther"] as const;

export function AgeCalculatorPage() {
  const { language, text } = useToolText();
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [birthDate, setBirthDate] = useState("");
  const [cutoffDate, setCutoffDate] = useState(todayValue);
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [relaxation, setRelaxation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [verifiedOn, setVerifiedOn] = useState("");
  const [category, setCategory] = useState<(typeof categoryKeys)[number]>(categoryKeys[6]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const age = birthDate && cutoffDate ? calculateAgeDetails(birthDate, cutoffDate) : null;
  const ageEvaluation = age
    ? evaluateAgeLimits(
        age.years,
        minAge === "" ? null : Number(minAge),
        maxAge === "" ? null : Number(maxAge),
        relaxation ? Number(relaxation) : 0,
        Boolean(relaxation && confirmed),
      )
    : null;

  function calculate(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const min = minAge ? Number(minAge) : null;
    const max = maxAge ? Number(maxAge) : null;
    const extra = relaxation ? Number(relaxation) : 0;
    if (!age) {
      setError(language === "en" ? "Enter a valid birth date on or before the cutoff date." : "कटऑफ़ तारीख़ से पहले या उसी दिन की सही जन्म तिथि दर्ज करें।");
      return;
    }
    if ((min !== null && (!Number.isInteger(min) || min < 0)) || (max !== null && (!Number.isInteger(max) || max < 0)) || (min !== null && max !== null && min > max)) {
      setError(language === "en" ? "Enter valid age limits; minimum must not exceed maximum." : "सही आयु सीमा दर्ज करें; न्यूनतम आयु अधिकतम से ज़्यादा न हो।");
      return;
    }
    if (relaxation && (!Number.isFinite(extra) || extra < 0 || !confirmed || !validateOfficialSource({ label: "Age relaxation", url: sourceUrl, verifiedOn }))) {
      setError(text.sourceInvalid);
      return;
    }
    setError("");
  }

  return (
    <ToolLayout pageId="age" title={text.age} description={text.ageDescription}>
      <form onSubmit={calculate} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
        <ToolPanel>
          <div className="grid gap-4 sm:grid-cols-2">
            <ToolField id="age-dob" label={text.dob}>
              <input required id="age-dob" type="date" max={cutoffDate} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className={inputClass} />
            </ToolField>
            <ToolField id="age-cutoff" label={text.cutoff}>
              <input required id="age-cutoff" type="date" value={cutoffDate} onChange={(event) => setCutoffDate(event.target.value)} className={inputClass} />
            </ToolField>
            <ToolField id="age-min" label={text.minAge}>
              <input id="age-min" type="number" min="0" max="120" value={minAge} onChange={(event) => setMinAge(event.target.value)} className={inputClass} />
            </ToolField>
            <ToolField id="age-max" label={text.maxAge}>
              <input id="age-max" type="number" min="0" max="120" value={maxAge} onChange={(event) => setMaxAge(event.target.value)} className={inputClass} />
            </ToolField>
          </div>
          {maxAge && (
            <div className="mt-5 space-y-4 rounded-xl bg-canvas p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ToolField id="age-category" label={text.feeCategory}>
                  <select id="age-category" value={category} onChange={(event) => setCategory(event.target.value as (typeof categoryKeys)[number])} className={inputClass}>
                    {categoryKeys.map((key) => <option key={key} value={key}>{text[key]}</option>)}
                  </select>
                </ToolField>
                <ToolField id="age-relaxation" label={text.relaxation}>
                  <input id="age-relaxation" type="number" min="0" max="50" value={relaxation} onChange={(event) => setRelaxation(event.target.value)} className={inputClass} />
                </ToolField>
              </div>
              {relaxation && (
                <>
                  <ToolField id="age-source" label={text.relaxationSource}>
                    <input id="age-source" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className={inputClass} placeholder="https://" />
                  </ToolField>
                  <ToolField id="age-verified" label={text.verifiedDate}>
                    <input id="age-verified" type="date" value={verifiedOn} onChange={(event) => setVerifiedOn(event.target.value)} className={inputClass} />
                  </ToolField>
                  <label className="flex items-start gap-2 text-sm leading-5">
                    <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 accent-forest" />
                    <span>{text.ruleChecked}</span>
                  </label>
                </>
              )}
            </div>
          )}
          {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
          <button type="submit" className={`${buttonClass} mt-5`}>{text.calculate}</button>
        </ToolPanel>
        <ToolPanel aria-live="polite">
          <h2 className="text-lg font-bold">{text.exactAge}</h2>
          {submitted && age ? (
            <>
              <p className="mt-4 text-3xl font-bold text-forest">
                {age.years} {language === "en" ? "years" : "वर्ष"} · {age.months} {language === "en" ? "months" : "माह"} · {age.days} {language === "en" ? "days" : "दिन"}
              </p>
              <h3 className="mt-6 font-bold">{text.eligibility}</h3>
              <p className={`mt-2 text-sm font-semibold ${ageEvaluation?.withinLimits ? "text-forest" : "text-amber-800"}`}>
                {ageEvaluation?.withinLimits ? text.withinLimit : text.outsideLimit}
              </p>
              {maxAge && <p className="mt-2 text-sm text-muted">{text.maxAge}: {maxAge}{relaxation && confirmed ? ` + ${relaxation} (${text[category]})` : ""}</p>}
              {minAge && <p className="mt-1 text-sm text-muted">{text.minAge}: {minAge}</p>}
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted">{text.ageDisclaimer}</p>
          )}
          <p className="mt-6 border-t border-line pt-4 text-xs leading-5 text-muted">{text.ageDisclaimer}</p>
        </ToolPanel>
      </form>
    </ToolLayout>
  );
}

export function SalaryEstimatorPage() {
  const { text } = useToolText();
  const [category, setCategory] = useState("");
  const [basic, setBasic] = useState("");
  const [da, setDa] = useState("");
  const [hra, setHra] = useState("");
  const [transport, setTransport] = useState("");
  const [deductions, setDeductions] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [verifiedOn, setVerifiedOn] = useState("");
  const [error, setError] = useState("");
  const [estimate, setEstimate] = useState<ReturnType<typeof estimateMonthlySalary>>(null);
  const [assumptions, setAssumptions] = useState<string[]>([]);

  function calculate(event: FormEvent) {
    event.preventDefault();
    const values = [basic, da, hra, transport, deductions].map(Number);
    const [basicPay, daPercent, hraPercent, transportAllowance, totalDeductions] = values;
    if (values.some((value, index) => ![basic, da, hra, transport, deductions][index] || !Number.isFinite(value) || value < 0) ||
        !validateOfficialSource({ label: "Salary assumptions", url: sourceUrl, verifiedOn })) {
      setEstimate(null);
      setError(text.sourceInvalid);
      return;
    }
    const result = estimateMonthlySalary({ basicPay, daPercent, hraPercent, transportAllowance, deductions: [totalDeductions] });
    if (!result) {
      setError(text.sourceInvalid);
      setEstimate(null);
      return;
    }
    setError("");
    setEstimate(result);
    setAssumptions([
      `${text.category}: ${category || text.unknown}`,
      `${text.basicPay}: ₹${basicPay.toLocaleString("en-IN")}`,
      `${text.daPercent}: ${daPercent}%`,
      `${text.hraPercent}: ${hraPercent}%`,
      `${text.transport}: ₹${transportAllowance.toLocaleString("en-IN")}`,
      `${text.deductionTotal}: ₹${totalDeductions.toLocaleString("en-IN")}`,
      `${text.sourceUrl}: ${sourceUrl}`,
      `${text.verifiedDate}: ${verifiedOn}`,
    ]);
  }

  return (
    <ToolLayout pageId="salary" title={text.salary} description={text.salaryDescription}>
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p>{text.notConfigured}</p>
        <p className="mt-1">{text.configUpdated}: {salaryConfig.lastUpdated ?? text.unknown}</p>
      </div>
      <form onSubmit={calculate} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <ToolPanel>
          <div className="grid gap-4 sm:grid-cols-2">
            <ToolField id="salary-category" label={text.category}>
              <input id="salary-category" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} />
            </ToolField>
            <ToolField id="salary-basic" label={text.basicPay}>
              <input required id="salary-basic" type="number" min="0" step="any" value={basic} onChange={(event) => setBasic(event.target.value)} className={inputClass} />
            </ToolField>
            <ToolField id="salary-da" label={text.daPercent}>
              <input required id="salary-da" type="number" min="0" max="1000" step="any" value={da} onChange={(event) => setDa(event.target.value)} className={inputClass} />
            </ToolField>
            <ToolField id="salary-hra" label={text.hraPercent}>
              <input required id="salary-hra" type="number" min="0" max="1000" step="any" value={hra} onChange={(event) => setHra(event.target.value)} className={inputClass} />
            </ToolField>
            <ToolField id="salary-transport" label={text.transport}>
              <input required id="salary-transport" type="number" min="0" step="any" value={transport} onChange={(event) => setTransport(event.target.value)} className={inputClass} />
            </ToolField>
            <ToolField id="salary-deductions" label={text.deductions}>
              <input required id="salary-deductions" type="number" min="0" step="any" value={deductions} onChange={(event) => setDeductions(event.target.value)} className={inputClass} />
            </ToolField>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ToolField id="salary-source" label={text.salarySource}>
              <input required id="salary-source" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className={inputClass} placeholder="https://" />
            </ToolField>
            <ToolField id="salary-date" label={text.verifiedDate}>
              <input required id="salary-date" type="date" value={verifiedOn} onChange={(event) => setVerifiedOn(event.target.value)} className={inputClass} />
            </ToolField>
          </div>
          {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
          <button type="submit" className={`${buttonClass} mt-5`}>{text.estimate}</button>
        </ToolPanel>
        <ToolPanel aria-live="polite">
          <h2 className="text-lg font-bold">{text.estimate}</h2>
          {estimate ? (
            <>
              <dl className="mt-4 space-y-3">
                <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-sm text-muted">{text.gross}</dt><dd className="font-bold">₹{estimate.gross.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</dd></div>
                <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-sm text-muted">{text.deductionTotal}</dt><dd className="font-bold">₹{estimate.deductions.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-sm font-semibold">{text.takeHome}</dt><dd className="text-lg font-bold text-forest">₹{estimate.takeHome.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</dd></div>
              </dl>
              <h3 className="mt-6 text-sm font-bold">{text.assumptions}</h3>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-muted">{assumptions.map((assumption) => <li key={assumption} className="break-all">{assumption}</li>)}</ul>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted">{text.estimateDisclaimer}</p>
          )}
          <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">{text.estimateDisclaimer}</p>
        </ToolPanel>
      </form>
    </ToolLayout>
  );
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export function DocumentChecklistPage() {
  const { language, text } = useToolText();
  const [items, setItems] = useState<ChecklistItem[]>(() =>
    documentRuleSets.flatMap((set) => set.items.map((item) => ({ id: `${set.examId}-${item.id}`, label: item.label, checked: false }))),
  );
  const [newItem, setNewItem] = useState("");

  function addItem(event: FormEvent) {
    event.preventDefault();
    const label = newItem.trim();
    if (!label) return;
    setItems((current) => [...current, { id: crypto.randomUUID(), label, checked: false }]);
    setNewItem("");
  }

  const toggle = (id: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, checked: !item.checked } : item));
  const remove = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  return (
    <ToolLayout pageId="documents" title={text.documents} description={text.documentsDescription}>
      <ToolPanel>
        <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">{text.noVerifiedChecklist}</p>
        <p className="mt-3 text-xs font-semibold text-muted">{text.noUpload}</p>
        {documentRuleSets.length > 0 && (
          <div className="mt-4">
            <h2 className="font-bold">{text.selectedRuleSet}</h2>
            <ul className="mt-2 space-y-2">{documentRuleSets.map((set) => <li key={set.examId}>{set.examLabel} · {set.verifiedOn} · {set.sources.map((source) => <a key={source.url} className="text-forest underline" href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}</li>)}</ul>
          </div>
        )}
        <form onSubmit={addItem} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="checklist-new" className="sr-only">{text.newItem}</label>
          <input id="checklist-new" value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder={text.newItem} className={inputClass} />
          <button type="submit" className={buttonClass}><Plus size={17} aria-hidden="true" />{text.add}</button>
        </form>
        <ul className="mt-5 divide-y divide-line print:mt-4">
          {items.map((item) => (
            <li key={item.id} className="flex min-h-14 items-center gap-3 py-2">
              <input type="checkbox" checked={item.checked} onChange={() => toggle(item.id)} aria-label={`${item.label} ${text.selected}`} className="size-5 accent-forest" />
              <span className={`flex-1 text-sm ${item.checked ? "text-muted line-through" : "text-ink"}`}>{item.label}</span>
              <button type="button" onClick={() => remove(item.id)} className="rounded p-2 text-muted hover:bg-red-50 hover:text-red-700 focus-visible:outline-forest print:hidden" aria-label={`${text.remove}: ${item.label}`}><Trash2 size={17} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3 print:hidden">
          <button type="button" onClick={() => window.print()} className={secondaryButtonClass}><CheckSquare size={17} aria-hidden="true" />{text.print}</button>
          <Link to="/about" className="inline-flex items-center text-sm font-semibold text-forest underline underline-offset-2">{language === "en" ? "Official-source guidance" : "आधिकारिक स्रोत संबंधी मार्गदर्शन"}</Link>
        </div>
      </ToolPanel>
    </ToolLayout>
  );
}

export function FeeCalculatorPage() {
  const { language, text } = useToolText();
  const [category, setCategory] = useState<(typeof categoryKeys)[number]>(categoryKeys[6]);
  const [gender, setGender] = useState("unknown");
  const [amount, setAmount] = useState("");
  const [categoryExempt, setCategoryExempt] = useState(false);
  const [genderExempt, setGenderExempt] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [verifiedOn, setVerifiedOn] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [fee, setFee] = useState<number | null>(null);
  const [ruleSource, setRuleSource] = useState("");

  function calculate(event: FormEvent) {
    event.preventDefault();
    if (amount === "" || !Number.isFinite(Number(amount)) || Number(amount) < 0 ||
        !confirmed || !validateOfficialSource({ label: "Fee rule", url: sourceUrl, verifiedOn }) ||
        (genderExempt && gender === "unknown")) {
      setError(text.sourceInvalid);
      setFee(null);
      return;
    }
    setError("");
    setFee(categoryExempt || genderExempt ? 0 : Number(amount));
    setRuleSource(sourceUrl);
  }

  return (
    <ToolLayout pageId="fees" title={text.fees} description={text.feesDescription}>
      <form onSubmit={calculate} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <ToolPanel>
          <p className="mb-5 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            {feeRuleSets.length === 0 ? text.noRules : feeRuleSets.map((rule) => rule.examLabel).join(", ")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ToolField id="fee-category" label={text.feeCategory}>
              <select id="fee-category" value={category} onChange={(event) => setCategory(event.target.value as (typeof categoryKeys)[number])} className={inputClass}>{categoryKeys.map((key) => <option key={key} value={key}>{text[key]}</option>)}</select>
            </ToolField>
            <ToolField id="fee-gender" label={text.gender}>
              <select id="fee-gender" value={gender} onChange={(event) => setGender(event.target.value)} className={inputClass}>
                <option value="unknown">{text.genderUnknown}</option>
                <option value="male">{text.genderMale}</option>
                <option value="female">{text.genderFemale}</option>
              </select>
            </ToolField>
            <ToolField id="fee-amount" label={text.feeAmount}>
              <input id="fee-amount" type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} />
            </ToolField>
            <ToolField id="fee-source" label={text.sourceUrl}>
              <input required id="fee-source" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className={inputClass} placeholder="https://" />
            </ToolField>
            <ToolField id="fee-date" label={text.verifiedDate}>
              <input required id="fee-date" type="date" value={verifiedOn} onChange={(event) => setVerifiedOn(event.target.value)} className={inputClass} />
            </ToolField>
          </div>
          <fieldset className="mt-5 space-y-3 rounded-xl bg-canvas p-4">
            <legend className="px-1 text-sm font-bold">{text.basedOn}</legend>
            <label className="flex items-start gap-2 text-sm leading-5"><input type="checkbox" checked={categoryExempt} onChange={(event) => setCategoryExempt(event.target.checked)} className="mt-1 accent-forest" /><span>{text.feeExemption} ({text[category]})</span></label>
            <label className="flex items-start gap-2 text-sm leading-5"><input type="checkbox" checked={genderExempt} onChange={(event) => setGenderExempt(event.target.checked)} className="mt-1 accent-forest" /><span>{text.genderExemption}</span></label>
            <label className="flex items-start gap-2 text-sm font-medium leading-5"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 accent-forest" /><span>{text.sourceVerified}</span></label>
          </fieldset>
          {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
          <button type="submit" className={`${buttonClass} mt-5`}><Ruler size={17} aria-hidden="true" />{text.calculate}</button>
        </ToolPanel>
        <ToolPanel aria-live="polite">
          <h2 className="text-lg font-bold">{text.feeResult}</h2>
          {fee === null ? (
            <p className="mt-3 text-sm leading-6 text-muted">{text.feeUnknown}</p>
          ) : (
            <>
              <p className="mt-4 text-3xl font-bold text-forest">{fee === 0 ? text.exempt : `₹${fee.toLocaleString("en-IN")}`}</p>
              <p className="mt-3 break-all text-xs leading-5 text-muted">{text.sourceUrl}: <a href={ruleSource} target="_blank" rel="noreferrer" className="text-forest underline">{ruleSource}</a></p>
            </>
          )}
          <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">{text.feeDisclaimer}</p>
          {feeRuleSets.length > 0 && <p className="mt-2 text-xs text-muted">{language === "en" ? "Verified configuration is maintained in tool-config.ts." : "सत्यापित कॉन्फ़िगरेशन tool-config.ts में रखा जाता है।"}</p>}
        </ToolPanel>
      </form>
    </ToolLayout>
  );
}
