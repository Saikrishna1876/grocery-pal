import { Text as RNText, type TextProps } from 'react-native';
import { cn } from '@/lib/utils';

type AppTextProps = TextProps & {
  className?: string;
};

export function AppText({ className, ...props }: AppTextProps) {
  return <RNText allowFontScaling className={cn('shrink', className)} {...props} />;
}
