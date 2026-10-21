import './global.css';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MapScreen from './rework/MapScreen';

// The original Gemini-built screen still lives in ./app/index.tsx; import it here to switch back.
export default function App() {
  return (
    <SafeAreaProvider>
      <MapScreen />
    </SafeAreaProvider>
  );
}
