import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useMutation } from 'convex/react';
import { dziriApi } from './api';
import { uploadMedia, type LocalMedia, type UploadedMedia } from './media-upload';
import { pickDocument, releaseDocument } from './pick-document';
import { MediaUploadCancelled, MAX_VOICE_SECONDS } from './message-media.generated';
export function useAttachment(imagesOnly = false) {
  const [attachment, setAttachment] = useState<LocalMedia | null>(null),
    [uploaded, setUploaded] = useState<UploadedMedia | null>(null),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [requesting, setRequesting] = useState(false);
  const recordingAttempt = useRef(0);
  const request = useRef<AbortController | null>(null);
  const previews = useRef(new Map<string, LocalMedia>()).current;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  const makeUrl = useMutation(dziriApi.uploadUrl);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY),
    state = useAudioRecorderState(recorder);
  const lock = useRef(false);
  const ownsAudioMode = useRef(false);
  const change = useCallback((media: LocalMedia | null) => {
    request.current?.abort();
    setAttachment(media);
    setUploaded(null);
    setFailed(false);
  }, []);
  useEffect(
    () => () => {
      if (attachment && previews.has(attachment.uri)) return;
      if (Platform.OS === 'web' && attachment?.uri.startsWith('blob:'))
        URL.revokeObjectURL(attachment.uri);
      if (attachment?.type === 'file') releaseDocument(attachment.uri);
    },
    [attachment, previews],
  );
  useEffect(
    () => () => {
      for (const media of previews.values()) {
        if (Platform.OS === 'web' && media.uri.startsWith('blob:')) URL.revokeObjectURL(media.uri);
        if (media.type === 'file') releaseDocument(media.uri);
      }
      previews.clear();
    },
    [previews],
  );
  async function chooseDocument() {
    if (imagesOnly || request.current) return;
    setFailed(false);
    try {
      const media = await pickDocument();
      if (media && mounted.current) change(media);
    } catch {
      if (mounted.current) setFailed(true);
    }
  }
  const finishVoice = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    const attempt = recordingAttempt.current;
    try {
      const duration = state.durationMillis;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      ownsAudioMode.current = false;
      if (recorder.uri && mounted.current && attempt === recordingAttempt.current)
        change({
          uri: recorder.uri,
          type: 'voice',
          mime: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
          duration,
        });
    } catch {
      setFailed(true);
    } finally {
      if (ownsAudioMode.current) {
        ownsAudioMode.current = false;
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
      lock.current = false;
    }
  }, [recorder, state.durationMillis, change]);
  const cancelVoice = useCallback(async () => {
    recordingAttempt.current++;
    if (!recorder.isRecording && !ownsAudioMode.current) return;
    if (lock.current) return;
    lock.current = true;
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      ownsAudioMode.current = false;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      lock.current = false;
    }
  }, [recorder]);
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= MAX_VOICE_SECONDS * 1000) void finishVoice();
  }, [state.isRecording, state.durationMillis, finishVoice]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => {
      if (value !== 'active') void cancelVoice();
    });
    return () => {
      listener.remove();
      void cancelVoice();
      if (ownsAudioMode.current) {
        ownsAudioMode.current = false;
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    };
  }, [cancelVoice]);
  async function choose() {
    setFailed(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: imagesOnly ? ['images'] : ['images', 'videos'],
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled) {
        const file = result.assets[0];
        change({
          uri: file.uri,
          type: file.type === 'video' ? 'video' : 'image',
          mime: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          width: file.width,
          height: file.height,
          duration: file.duration ?? undefined,
          name: file.fileName ?? undefined,
          size: file.fileSize,
        });
      }
    } catch {
      setFailed(true);
    }
  }
  async function startVoice() {
    if (lock.current || imagesOnly || request.current) return;
    lock.current = true;
    const attempt = ++recordingAttempt.current;
    setRequesting(true);
    setFailed(false);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (
        !mounted.current ||
        attempt !== recordingAttempt.current ||
        AppState.currentState !== 'active'
      )
        return;
      if (!permission.granted) throw new Error('Microphone unavailable');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      ownsAudioMode.current = true;
      await recorder.prepareToRecordAsync();
      if (
        !mounted.current ||
        attempt !== recordingAttempt.current ||
        AppState.currentState !== 'active'
      ) {
        ownsAudioMode.current = false;
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      recorder.record();
    } catch {
      if (mounted.current && attempt === recordingAttempt.current) setFailed(true);
      if (ownsAudioMode.current) {
        ownsAudioMode.current = false;
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    } finally {
      if (mounted.current) setRequesting(false);
      lock.current = false;
    }
  }
  async function upload() {
    if (!attachment) throw new Error('No attachment');
    if (imagesOnly && attachment.type !== 'image') throw new Error('Only images supported');
    if (uploaded?.uri === attachment.uri) return uploaded;
    if (request.current) throw new Error('Upload already in progress');
    const control = new AbortController();
    request.current = control;
    setBusy(true);
    setFailed(false);
    setProgress(0);
    try {
      const media = await uploadMedia(attachment, () => makeUrl({}), {
        signal: control.signal,
        onProgress: value => {
          if (mounted.current && !control.signal.aborted) setProgress(value);
        },
      });
      if (!mounted.current || control.signal.aborted) throw new MediaUploadCancelled();
      setUploaded(media);
      return media;
    } catch (error) {
      if (mounted.current && !control.signal.aborted) setFailed(true);
      throw error;
    } finally {
      if (request.current === control) request.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    attachment,
    change,
    choose,
    chooseDocument,
    retainPreview: () => {
      if (attachment) {
        previews.set(attachment.uri, attachment);
        if (previews.size > 20) {
          const oldest = previews.values().next().value as LocalMedia;
          previews.delete(oldest.uri);
          if (Platform.OS === 'web' && oldest.uri.startsWith('blob:'))
            URL.revokeObjectURL(oldest.uri);
          if (oldest.type === 'file') releaseDocument(oldest.uri);
        }
      }
    },
    cancelUpload: () => request.current?.abort(),
    progress,
    startVoice,
    cancelVoice,
    requesting,
    finishVoice,
    upload,
    busy,
    failed,
    recording: state.isRecording,
    seconds: Math.floor(state.durationMillis / 1000),
  };
}
