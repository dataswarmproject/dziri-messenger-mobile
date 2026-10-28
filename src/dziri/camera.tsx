import React, { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from './typography';
import { FigmaButton, FigmaIcon } from './figma';
import { useLocale } from './locale';
import type { LocalMedia } from './media-upload';
export function CameraCapture({
  open,
  close,
  captured,
  gallery,
}: {
  open: boolean;
  close: () => void;
  captured: (media: LocalMedia) => void;
  gallery: () => void;
}) {
  const camera = useRef<CameraView>(null);
  const [permission, request] = useCameraPermissions();
  const [front, setFront] = useState(false),
    [flash, setFlash] = useState(false),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  const { t, rtl } = useLocale();
  async function take() {
    if (busy || !ready) return;
    setBusy(true);
    setError(false);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.85, exif: false });
      if (!photo) throw new Error('No photo');
      captured({
        uri: photo.uri,
        type: 'image',
        mime: 'image/jpeg',
        width: photo.width,
        height: photo.height,
      });
      close();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 36, paddingBottom: 24 }}>
        {permission?.granted ? (
          <CameraView
            ref={camera}
            facing={front ? 'front' : 'back'}
            enableTorch={!front && flash}
            onCameraReady={() => setReady(true)}
            onMountError={() => setError(true)}
            style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void request()}
              style={{ padding: 20 }}>
              <Text style={{ color: '#fff', fontSize: 17 }}>{t.camera}</Text>
            </Pressable>
          </View>
        )}
        <View
          style={{
            position: 'absolute',
            top: 48,
            left: 8,
            right: 8,
            flexDirection: rtl ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
          }}>
          <FigmaButton name="cameraClose" label={t.close} onPress={close} />
          <FigmaButton
            name="cameraFlash"
            label={t.flash}
            onPress={() => setFlash(value => !value)}
          />
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={{ color: '#fff', padding: 16 }}>
            {t.failed}
          </Text>
        ) : null}
        <View
          style={{
            height: 120,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}>
          <FigmaButton
            name="cameraGallery"
            label={t.photo}
            onPress={() => {
              close();
              gallery();
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.photo}
            disabled={busy || !ready}
            onPress={() => void take()}
            style={{
              width: 80,
              height: 80,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.5 : 1,
            }}>
            <FigmaIcon name="shutter" />
          </Pressable>
          <FigmaButton
            name="switchCamera"
            label={t.flipCamera}
            onPress={() => {
              setReady(false);
              setFront(value => !value);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
