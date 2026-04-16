import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as faceapi from 'face-api.js';
import { X, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

type CaptureStep = 'center' | 'left' | 'right' | 'complete';

interface AdminFaceCaptureProps {
  userName: string;
  onEnroll: (descriptor: Float32Array) => Promise<void>;
  onCancel: () => void;
}

function estimateYaw(landmarks: faceapi.FaceLandmarks68): number {
  const nose = landmarks.getNose();
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const eyeMidX = (leftEye[0].x + rightEye[3].x) / 2;
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
  for (let index = 0; index < data.length; index += 4) {
    sum += (data[index] + data[index + 1] + data[index + 2]) / 3;
  }
  return sum / (50 * 50);
}

function averageDescriptors(descriptors: Float32Array[]): Float32Array {
  const averaged = new Float32Array(descriptors[0].length);
  descriptors.forEach((descriptor) => {
    descriptor.forEach((value, index) => {
      averaged[index] += value;
    });
  });
  for (let index = 0; index < averaged.length; index += 1) {
    averaged[index] /= descriptors.length;
  }
  return averaged;
}

export default function AdminFaceCapture({ userName, onEnroll, onCancel }: AdminFaceCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState('');
  const [instruction, setInstruction] = useState('Place the face within the circle');
  const [step, setStep] = useState<CaptureStep>('center');
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const holdRef = useRef(0);
  const rafRef = useRef<number>(0);
  const currentStepRef = useRef<CaptureStep>('center');
  const completedRef = useRef(false);
  const descriptorsRef = useRef<Float32Array[]>([]);
  const capturedStepsRef = useRef<Set<CaptureStep>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        if (!cancelled) {
          setModelsLoaded(true);
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch (err) {
        console.error('Failed to start camera:', err);
        if (!cancelled) {
          setError('Camera and face-recognition models must be available to enroll a user.');
        }
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!modelsLoaded || !cameraReady || loading || success) return;

    const detect = async () => {
      if (completedRef.current) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const brightness = sampleBrightness(video);
      if (brightness < 28) {
        setError('Poor lighting detected. Move to a well-lit area before enrolling.');
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) {
        setError('');
        setInstruction('No face detected. Keep the subject centered in the frame.');
        holdRef.current = 0;
        setProgress(0);
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const box = detection.detection.box;
      const centerX = box.x + box.width / 2;
      const videoCenter = video.videoWidth / 2;
      const centered = Math.abs(centerX - videoCenter) < video.videoWidth * 0.18 && box.width > video.videoWidth * 0.12;
      const yaw = estimateYaw(detection.landmarks);
      const currentStep = currentStepRef.current;

      let nextStep = currentStep;
      let nextInstruction = 'Place the face within the circle';
      const needHold = currentStep === 'center' ? 1500 : 1000;

      if (currentStep === 'center') {
        nextInstruction = 'Hold steady while facing forward';
        if (centered && Math.abs(yaw) < 14) {
          holdRef.current += 33;
        } else {
          holdRef.current = 0;
        }
        if (holdRef.current >= needHold) {
          if (!capturedStepsRef.current.has('center')) {
            descriptorsRef.current.push(detection.descriptor);
            capturedStepsRef.current.add('center');
          }
          nextStep = 'left';
          holdRef.current = 0;
        }
      } else if (currentStep === 'left') {
        nextInstruction = 'Slowly turn the head to the LEFT';
        if (yaw < -12) {
          holdRef.current += 33;
        } else {
          holdRef.current = 0;
        }
        if (holdRef.current >= needHold) {
          if (!capturedStepsRef.current.has('left')) {
            descriptorsRef.current.push(detection.descriptor);
            capturedStepsRef.current.add('left');
          }
          nextStep = 'right';
          holdRef.current = 0;
        }
      } else if (currentStep === 'right') {
        nextInstruction = 'Slowly turn the head to the RIGHT';
        if (yaw > 12) {
          holdRef.current += 33;
        } else {
          holdRef.current = 0;
        }
        if (holdRef.current >= needHold) {
          if (!capturedStepsRef.current.has('right')) {
            descriptorsRef.current.push(detection.descriptor);
            capturedStepsRef.current.add('right');
          }
          nextStep = 'complete';
        }
      }

      if (nextStep !== currentStep) {
        currentStepRef.current = nextStep;
        setStep(nextStep);
      }

      setError('');
      setInstruction(nextInstruction);
      setProgress(Math.min(100, (holdRef.current / needHold) * 100));

      if (nextStep === 'complete' && !completedRef.current) {
        completedRef.current = true;
        if (descriptorsRef.current.length < 3) {
          setError('Enrollment requires center, left, and right captures. Please try again.');
          setInstruction('Place the face within the circle');
          setProgress(0);
          setStep('center');
          currentStepRef.current = 'center';
          capturedStepsRef.current = new Set();
          descriptorsRef.current = [];
          holdRef.current = 0;
          completedRef.current = false;
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        setLoading(true);
        try {
          await onEnroll(averageDescriptors(descriptorsRef.current));
          setSuccess(true);
          setInstruction('Identity profile captured successfully');
        } catch (captureError) {
          console.error('Face capture error:', captureError);
          setError('Face enrollment failed. Please retry with the subject fully visible to the camera.');
          setInstruction('Place the face within the circle');
          setProgress(0);
          setStep('center');
          currentStepRef.current = 'center';
          capturedStepsRef.current = new Set();
          descriptorsRef.current = [];
          holdRef.current = 0;
          completedRef.current = false;
          setLoading(false);
          rafRef.current = requestAnimationFrame(detect);
          return;
        }
        setLoading(false);
        return;
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraReady, loading, modelsLoaded, onEnroll, success]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#232f3e]/60 backdrop-blur-sm p-6"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg overflow-hidden rounded-sm border border-[#eaeded] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#eaeded] bg-[#f2f3f3] px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#232f3e]" />
            <h3 className="font-bold text-[#232f3e]">Biometric Enrollment: {userName}</h3>
          </div>
          <button onClick={onCancel} className="text-[#565959] hover:text-[#232f3e]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-8">
          <div className="relative mx-auto mb-8 h-72 w-72">
            <div className="absolute inset-0 z-10 rounded-full border-4 border-dashed border-[#e47911]/30" />
            <div className="absolute inset-0 overflow-hidden rounded-full border-4 border-white bg-[#f2f3f3] shadow-inner">
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
                initial={{ opacity: 0, scale: 0.6 }}
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
            <div className="rounded-sm border border-[#e47911]/20 bg-[#fff4e5] p-4 text-xs font-bold text-[#e47911]">
              Admin enrollment now follows the same center-left-right capture flow used during verification.
            </div>

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

            {!success && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-8">
                  {(['center', 'left', 'right'] as CaptureStep[]).map((captureStep, index) => (
                    <div key={captureStep} className="flex items-center gap-8">
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-colors ${
                            step === captureStep
                              ? 'border-[#e47911] bg-[#fff4e5] text-[#e47911]'
                              : 'border-[#eaeded] text-[#565959]'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                          {captureStep}
                        </span>
                      </div>
                      {index < 2 && <div className="h-px w-8 bg-[#eaeded]" />}
                    </div>
                  ))}
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

            {loading && !success && (
              <div className="py-2 text-sm font-bold text-[#e47911]">
                Saving biometric profile...
              </div>
            )}

            {!success && (
              <button
                onClick={onCancel}
                className="w-full rounded-sm border border-[#879596] py-2 text-sm font-bold text-[#565959] transition-colors hover:bg-[#f2f3f3]"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#f2f3f3] px-6 py-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959]">
            Identity Authority Verification Module
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
