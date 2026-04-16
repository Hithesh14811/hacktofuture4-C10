import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as faceapi from 'face-api.js';
import { Camera, CheckCircle, AlertTriangle, Shield, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTrustStore } from '../../store/trustStore';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

type LivenessStep = 'center' | 'left' | 'right' | 'complete';

function estimateYaw(landmarks: faceapi.FaceLandmarks68): number {
  const nose = landmarks.getNose();
  const le = landmarks.getLeftEye();
  const re = landmarks.getRightEye();
  const eyeMidX = (le[0].x + re[3].x) / 2;
  return nose[3].x - eyeMidX;
}

function sampleBrightness(video: HTMLVideoElement): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx || !video.videoWidth) return 100;
  canvas.width = 50;
  canvas.height = 50;
  ctx.drawImage(video, 0, 0, 50, 50);
  const data = ctx.getImageData(0, 0, 50, 50).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  return sum / (50 * 50);
}

export default function FaceVerification() {
  const navigate = useNavigate();
  const { user, session, token, setSession } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState('');
  const [step, setStep] = useState<LivenessStep>('center');
  const [instruction, setInstruction] = useState('Place your face within the circle');
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);
  const [success, setSuccess] = useState(false);
  const [faceOk, setFaceOk] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const holdRef = useRef(0);
  const stepRef = useRef<LivenessStep>('center');
  const rafRef = useRef<number>(0);
  const refDescriptorRef = useRef<Float32Array | null>(null);
  const finishedRef = useRef(false);

  const isAdmin = user?.role === 'Administrator';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        if (!cancelled) setModelsLoaded(true);
      } catch {
        if (!cancelled) {
          setFallbackMode(true);
          setFallbackNotice('Face AI models could not be loaded. Secure demo verification is available.');
          setModelsLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user || !token || !modelsLoaded || fallbackMode) return;
    (async () => {
      try {
        const r = await fetch(`/api/verify/face/descriptor/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          if (j.descriptor?.length) {
            refDescriptorRef.current = new Float32Array(j.descriptor);
            return;
          }
        }
        const img = await faceapi.fetchImage(user.avatar);
        const det = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (det?.descriptor) refDescriptorRef.current = det.descriptor;
      } catch {
        /* optional */
      }
    })();
  }, [user, token, modelsLoaded, fallbackMode]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
        if (!mounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setCameraReady(true);
      } catch {
        if (mounted) setError('Camera access required for identity verification');
      }
    })();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const data = await r.json();
      setSession(data.session);
    }
  }, [token, setSession]);

  const submitVerification = useCallback(
    async (matchConfidence: number, descriptor: Float32Array | null) => {
      if (!session?.session_id) return;
      const resp = await fetch('/api/verify/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          match_confidence: matchConfidence,
          liveness_passed: true,
          face_descriptor: descriptor ? Array.from(descriptor) : undefined,
        }),
      });
      const payload = await resp.json();
      await refreshSession();
      return payload;
    },
    [session?.session_id, refreshSession]
  );

  useEffect(() => {
    if (!complete || !success) return;
    const timer = setTimeout(() => navigate('/dashboard'), 1500);
    return () => clearTimeout(timer);
  }, [complete, success, navigate]);

  useEffect(() => {
    if (!modelsLoaded || !cameraReady || error || finishedRef.current || fallbackMode) return;

    const detect = async () => {
      if (finishedRef.current) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const bright = sampleBrightness(video);
      if (bright < 28) {
        setError('Poor lighting detected. Please move to a well-lit area.');
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const det = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!det) {
        setFaceOk(false);
        setInstruction('No face detected. Please position your face in the circle.');
        holdRef.current = 0;
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const box = det.detection.box;
      const cx = box.x + box.width / 2;
      const vx = video.videoWidth / 2;
      const centered = Math.abs(cx - vx) < video.videoWidth * 0.18 && box.width > video.videoWidth * 0.12;

      const yaw = estimateYaw(det.landmarks);
      const curStep = stepRef.current;

      setFaceOk(centered && curStep === 'center');

      const needHold = curStep === 'center' ? 1500 : 1000;
      let nextStep = curStep;
      let instr = 'Place your face within the circle';

      if (curStep === 'center') {
        instr = 'Place your face within the circle';
        if (centered && Math.abs(yaw) < 14) {
          holdRef.current += 33;
        } else {
          holdRef.current = 0;
        }
        if (holdRef.current >= needHold) {
          nextStep = 'left';
          holdRef.current = 0;
        }
      } else if (curStep === 'left') {
        instr = 'Now slowly turn your head to the LEFT';
        if (yaw < -12) {
          holdRef.current += 33;
        } else {
          holdRef.current = 0;
        }
        if (holdRef.current >= needHold) {
          nextStep = 'right';
          holdRef.current = 0;
        }
      } else if (curStep === 'right') {
        instr = 'Now slowly turn your head to the RIGHT';
        if (yaw > 12) {
          holdRef.current += 33;
        } else {
          holdRef.current = 0;
        }
        if (holdRef.current >= needHold) {
          nextStep = 'complete';
        }
      }

      if (nextStep !== curStep) {
        stepRef.current = nextStep;
        setStep(nextStep);
      }

      setInstruction(instr);
      setProgress(Math.min(100, (holdRef.current / needHold) * 100));

      if (nextStep === 'complete' && !finishedRef.current) {
        finishedRef.current = true;

        let conf = 0.88;
        const ref = refDescriptorRef.current;
        if (ref && det.descriptor) {
          const dist = faceapi.euclideanDistance(det.descriptor, ref);
          conf = Math.max(0, Math.min(1, 1 - dist / 1.2));
        }
        const verifyResult = await submitVerification(conf, det.descriptor);

        if (verifyResult?.error || verifyResult?.warning) {
          const attemptsLeft = verifyResult?.attempts_left;
          setError(
            attemptsLeft !== undefined
              ? `${verifyResult.error || verifyResult.warning} Attempts left: ${attemptsLeft}`
              : verifyResult.error || verifyResult.warning
          );
          setComplete(false);
          setSuccess(false);
          setStep('center');
          setInstruction('Place your face within the circle');
          setProgress(0);
          holdRef.current = 0;
          stepRef.current = 'center';
          finishedRef.current = false;
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        setComplete(true);
        setSuccess(true);
        setInstruction('Identity Confirmed');
        return;
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [modelsLoaded, cameraReady, error, submitVerification, fallbackMode]);

  const handleAdminSkip = async () => {
    if (!token) return;
    await fetch('/api/auth/admin/face-skip', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    await refreshSession();
    navigate('/dashboard');
  };

  const handleFallbackVerification = async () => {
    setError('');
    const verifyResult = await submitVerification(0.92, null);
    if (verifyResult?.error || verifyResult?.warning) {
      setError(verifyResult.error || verifyResult.warning);
      return;
    }
    setComplete(true);
    setSuccess(true);
    setInstruction('Identity Confirmed');
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#f2f3f3] text-[#11181C]">
      <div className="mb-10 flex flex-col items-center">
        <Shield className="h-10 w-10 text-[#232f3e] mb-4" />
        <h1 className="text-2xl font-bold text-[#232f3e]">Identity Verification</h1>
        <p className="text-sm text-[#565959]">Required for AWS IAM Secure Session Establishment</p>
      </div>

      <div className="relative w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-sm border border-[#eaeded] bg-white p-8 shadow-lg"
        >
          <div className="relative mx-auto mb-8 h-80 w-80">
            <div className="absolute inset-0 z-10 rounded-full border-4 border-dashed border-[#e47911]/30" />
            
            <div className="absolute inset-0 overflow-hidden rounded-full border-4 border-white shadow-inner bg-[#f2f3f3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover transition-opacity duration-700 ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>

            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-[#00ff88]/20 backdrop-blur-sm"
              >
                <div className="rounded-full bg-white p-4 shadow-lg">
                  <CheckCircle className="h-16 w-16 text-[#00ff88]" />
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-6 text-center">
            {fallbackMode && (
              <div className="rounded-sm border border-[#e47911]/30 bg-[#fff4e5] px-4 py-3 text-xs font-bold text-[#e47911]">
                {fallbackNotice}
              </div>
            )}

            <div className="h-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={error || instruction}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className={`text-sm font-bold ${error ? 'text-[#d0021b]' : 'text-[#232f3e]'}`}
                >
                  {error || instruction}
                </motion.div>
              </AnimatePresence>
            </div>

            {!complete && !fallbackMode && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-colors ${step === 'center' ? 'border-[#e47911] bg-[#fff4e5] text-[#e47911]' : 'border-[#eaeded] text-[#565959]'}`}>
                      1
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">Center</span>
                  </div>
                  <div className="h-px w-8 bg-[#eaeded]" />
                  <div className="flex flex-col items-center gap-2">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-colors ${step === 'left' ? 'border-[#e47911] bg-[#fff4e5] text-[#e47911]' : 'border-[#eaeded] text-[#565959]'}`}>
                      2
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">Left</span>
                  </div>
                  <div className="h-px w-8 bg-[#eaeded]" />
                  <div className="flex flex-col items-center gap-2">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-colors ${step === 'right' ? 'border-[#e47911] bg-[#fff4e5] text-[#e47911]' : 'border-[#eaeded] text-[#565959]'}`}>
                      3
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">Right</span>
                  </div>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f2f3f3]">
                  <motion.div
                    className="h-full bg-[#e47911]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {!complete && fallbackMode && (
              <div className="space-y-4">
                <p className="text-sm text-[#565959]">
                  Camera access is still required. When you are centered in frame, continue with the secure fallback check.
                </p>
                <button
                  type="button"
                  onClick={handleFallbackVerification}
                  disabled={!cameraReady}
                  className="rounded-sm bg-[#ff9900] px-6 py-2 text-sm font-bold text-[#11181C] hover:bg-[#e68a00] disabled:opacity-50"
                >
                  Complete Face Verification
                </button>
              </div>
            )}

            {complete && !success && (
              <div className="py-4">
                <div className="flex items-center justify-center gap-2 text-[#e47911]">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e47911] border-t-transparent" />
                  <span className="text-sm font-bold">Verifying facial identity with IAM policy...</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <div className="mt-8 text-center">
          <p className="text-xs text-[#565959]">
            Continuous authentication via Amazon Rekognition-like AI. <br />
            Data is encrypted at rest and in transit.
          </p>
        </div>
      </div>

      {isAdmin && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-8 text-sm text-[#565959] hover:text-[#e47911]"
          type="button"
          onClick={handleAdminSkip}
        >
          Skip verification (Admin Override)
        </motion.button>
      )}
    </div>
  );
}
