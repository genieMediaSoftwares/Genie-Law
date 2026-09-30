import { Animated } from 'react-native';
import { cssInterop } from 'react-native-css-interop/dist/runtime/api';

cssInterop(Animated.View as any, { className: 'style' });
cssInterop(Animated.Text as any, { className: 'style' });
cssInterop(Animated.ScrollView as any, { className: 'style' });
