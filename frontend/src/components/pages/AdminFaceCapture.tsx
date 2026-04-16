import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as faceapi from 'face-api.js';
import { Camera, X, Shield, AlertTriangle } from 'lucide-react';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

interface AdminFaceCaptureProps {
  userName: string;
  onEnroll: (descriptor: Float32Array) => Promise<void>;
  onCancel: () => void;
}

export default function AdminFaceCapture({ userName, onEnroll, onCancel }: AdminFaceCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const handleCapture = async () => {
    setLoading(true);
    setError('');
    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        setError('Camera feed is not ready yet. Please wait a moment and try again.');
        return;
      }

      const detections: Float32Array[] = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (detection?.descriptor) {
          detections.push(detection.descriptor);
        }

        if (detections.length >= 3) {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 220));
      }

      if (detections.length < 3) {
        setError('A clear face could not be captured. Keep the subject centered, fully visible, and well lit.');
        return;
      }

      const averagedDescriptor = new Float32Array(detections[0].length);
      detections.forEach((descriptor) => {
        descriptor.forEach((value, index) => {
          averagedDescriptor[index] += value;
        });
      });
      for (let index = 0; index < averagedDescriptor.length; index += 1) {
        averagedDescriptor[index] /= detections.length;
      }

      await onEnroll(averagedDescriptor);
    } catch (err) {
      console.error('Face capture error:', err);
      setError('Face enrollment failed. Please retry with the subject fully visible to the camera.');
    } finally {
      setLoading(false);
    }
  };

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
        className="w-full max-w-lg overflow-hidden rounded-sm bg-white shadow-2xl border border-[#eaeded]"
      >
        <div className="bg-[#f2f3f3] px-6 py-4 border-b border-[#eaeded] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#232f3e]" />
            <h3 className="font-bold text-[#232f3e]">Biometric Enrollment: {userName}</h3>
          </div>
          <button onClick={onCancel} className="text-[#565959] hover:text-[#232f3e]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-8">
          <div className="relative mx-auto mb-8 aspect-square w-64 overflow-hidden rounded-full border-4 border-[#eaeded] bg-[#f2f3f3] shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute inset-0 border-2 border-dashed border-[#e47911]/30 rounded-full animate-pulse" />
          </div>

          <div className="space-y-6 text-center">
            <div className="rounded-sm bg-[#fff4e5] p-4 text-xs text-[#e47911] font-bold border border-[#e47911]/20">
              Admin scan required for initial identity establishment. Ensure the subject's face is clearly visible and centered.
            </div>

            {error && (
              <div className="rounded-sm border border-[#d0021b]/20 bg-[#fdf0f1] p-4 text-sm text-[#d0021b]">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={onCancel}
                className="flex-1 rounded-sm border border-[#879596] py-2 text-sm font-bold text-[#565959] hover:bg-[#f2f3f3] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCapture}
                disabled={loading || !modelsLoaded}
                className="flex-1 rounded-sm bg-[#ff9900] py-2 text-sm font-bold text-[#11181C] hover:bg-[#e68a00] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#11181C] border-t-transparent" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    {modelsLoaded ? 'Capture & Enroll' : 'Loading biometric models...'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#f2f3f3] px-6 py-3 text-center">
          <p className="text-[10px] text-[#565959] uppercase font-bold tracking-widest">
            Identity Authority Verification Module
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
