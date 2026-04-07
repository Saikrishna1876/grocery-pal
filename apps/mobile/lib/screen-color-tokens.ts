type ScreenColorTokens = {
  iconColor: string;
  mutedColor: string;
  selectedCardBg: string;
  selectedCardBorder: string;
  selectedLabelColor: string;
  selectedDescColor: string;
};

export const getScreenColorTokens = (isDark: boolean): ScreenColorTokens => ({
  iconColor: isDark ? '#e5e5e5' : '#171717',
  mutedColor: isDark ? '#a3a3a3' : '#737373',
  selectedCardBg: isDark ? '#111827' : '#f3f4f6',
  selectedCardBorder: isDark ? '#60a5fa' : '#2563eb',
  selectedLabelColor: isDark ? '#f9fafb' : '#111827',
  selectedDescColor: isDark ? '#d1d5db' : '#4b5563',
});
