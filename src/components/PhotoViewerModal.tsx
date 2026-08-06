/**
 * PhotoViewerModal — visor de foto a pantalla completa con zoom pinch y pan.
 * Extraído para compartir entre AddDebtModal y PersonDetailScreen.
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  uri:     string | null;
  onClose: () => void;
}

export function PhotoViewerModal({ uri, onClose }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx    = useRef(new Animated.Value(0)).current;
  const ty    = useRef(new Animated.Value(0)).current;

  const curScale = useRef(1);
  const curTx    = useRef(0);
  const curTy    = useRef(0);

  const prevGestureScale = useRef(1);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const pinchRef  = useRef<any>(null);
  const panRef    = useRef<any>(null);

  // Resetear estado al cambiar de foto
  useEffect(() => {
    scale.setValue(1); tx.setValue(0); ty.setValue(0);
    curScale.current = 1; curTx.current = 0; curTy.current = 0;
  }, [uri]);

  function onPinchEvent(e: any) {
    const { scale: gs, focalX: fx, focalY: fy } = e.nativeEvent;

    // Delta incremental respecto al frame anterior (no al inicio del gesto)
    const ds = gs / prevGestureScale.current;
    prevGestureScale.current = gs;

    const rawScale    = curScale.current * ds;
    const newScale    = Math.min(Math.max(rawScale, 1), 5);
    const effectiveDs = newScale / curScale.current;

    // El punto focal queda fijo en pantalla
    const newTx = (fx - SCREEN_W / 2) * (1 - effectiveDs) + curTx.current * effectiveDs;
    const newTy = (fy - SCREEN_H / 2) * (1 - effectiveDs) + curTy.current * effectiveDs;

    curScale.current = newScale;
    curTx.current    = newTx;
    curTy.current    = newTy;
    scale.setValue(newScale);
    tx.setValue(newTx);
    ty.setValue(newTy);
  }

  function onPinchStateChange(e: any) {
    if (e.nativeEvent.state === State.BEGAN) {
      prevGestureScale.current = 1;
    }
    if (e.nativeEvent.oldState === State.ACTIVE && curScale.current <= 1) {
      curScale.current = 1; curTx.current = 0; curTy.current = 0;
      scale.setValue(1); tx.setValue(0); ty.setValue(0);
    }
  }

  function onPanEvent(e: any) {
    if (curScale.current > 1) {
      curTx.current = panStartX.current + e.nativeEvent.translationX;
      curTy.current = panStartY.current + e.nativeEvent.translationY;
      tx.setValue(curTx.current);
      ty.setValue(curTy.current);
    }
  }

  function onPanStateChange(e: any) {
    if (e.nativeEvent.state === State.BEGAN) {
      panStartX.current = curTx.current;
      panStartY.current = curTy.current;
    }
  }

  return (
    <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={S.overlay}>
          <PanGestureHandler
            ref={panRef}
            onGestureEvent={onPanEvent}
            onHandlerStateChange={onPanStateChange}
            simultaneousHandlers={pinchRef}
            minPointers={1}
            maxPointers={1}
          >
            <Animated.View collapsable={false}>
              <PinchGestureHandler
                ref={pinchRef}
                onGestureEvent={onPinchEvent}
                onHandlerStateChange={onPinchStateChange}
                simultaneousHandlers={panRef}
              >
                <Animated.Image
                  source={{ uri: uri ?? '' }}
                  style={[S.image, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}
                  resizeMode="contain"
                />
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>

          <TouchableOpacity style={S.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={S.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H * 0.85,
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(240,91,83,0.25)',
    borderWidth: 2,
    borderColor: '#F05B53',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#F05B53', fontSize: 16, fontWeight: '700' },
});
