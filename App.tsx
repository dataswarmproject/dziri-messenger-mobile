import 'react-native-gesture-handler';
import './reanimatedConfig';

// Inbox companion uses the existing Rails service, without legacy telemetry/store.
export { default } from './src/inbox/app';
