import { api } from '@/convex/_generated/api';
import { getErrorMessage } from '@/lib/error';
import { useAction } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Camera, FileText, Image, ShoppingBag } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ScanScreen() {
  const { monthId, monthTitle } = useLocalSearchParams<{
    monthId: string;
    monthTitle: string;
  }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [scanType, setScanType] = React.useState<'receipt' | 'list' | 'groceries'>('receipt');
  const [processing, setProcessing] = React.useState(false);
  const processImageAction = useAction(api.scan.processImage);

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please grant camera/photo access to use this feature.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          base64: true,
          quality: 0.7,
          allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          base64: true,
          quality: 0.7,
          allowsEditing: true,
        });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      await processImage(result.assets[0].base64 ?? '');
    }
  };

  const processImage = async (base64: string) => {
    setProcessing(true);
    try {
      const data = await processImageAction({ image: base64, type: scanType });
      router.replace({
        pathname: '/order/review',
        params: {
          monthId,
          monthTitle,
          items: JSON.stringify(data.items || []),
          source: scanType,
        },
      });
    } catch (error: unknown) {
      Alert.alert('Error', getErrorMessage(error, 'Failed to process image'));
      setImageUri(null);
    } finally {
      setProcessing(false);
    }
  };

  const scanTypes = [
    {
      key: 'receipt' as const,
      label: 'Receipt / Bill',
      icon: FileText,
      desc: 'Photo of a grocery bill',
    },
    {
      key: 'list' as const,
      label: 'Shopping List',
      icon: ShoppingBag,
      desc: 'Handwritten or printed list',
    },
    { key: 'groceries' as const, label: 'Groceries', icon: Image, desc: 'Photo of actual items' },
  ];

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border px-5 pb-4 pt-14">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
            <ArrowLeft size={22} color={iconColor} />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-foreground">Scan Items</Text>
            <Text className="text-xs text-muted-foreground">{monthTitle}</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        {processing ? (
          <View className="items-center py-20">
            {imageUri && (
              <RNImage
                source={{ uri: imageUri }}
                style={{ width: 200, height: 200, borderRadius: 16, marginBottom: 20 }}
                resizeMode="cover"
              />
            )}
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-base font-medium text-foreground">
              Analyzing image with AI...
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Extracting items, quantities, and prices
            </Text>
          </View>
        ) : (
          <>
            <Text className="mb-3 text-sm font-semibold text-foreground">
              What are you scanning?
            </Text>
            <View className="mb-6 gap-2">
              {scanTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = scanType === type.key;

                return (
                  <TouchableOpacity
                    key={type.key}
                    onPress={() => setScanType(type.key)}
                    className={`flex-row items-center gap-3 rounded-xl border p-4 ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}>
                    <Icon size={22} color={isSelected ? iconColor : mutedColor} />
                    <View className="flex-1">
                      <Text
                        className={`text-sm font-medium ${
                          isSelected ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                        {type.label}
                      </Text>
                      <Text className="text-xs text-muted-foreground">{type.desc}</Text>
                    </View>
                    <View
                      className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                        isSelected ? 'border-primary' : 'border-muted-foreground/30'
                      }`}>
                      {isSelected && <View className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="mb-3 text-sm font-semibold text-foreground">Capture Image</Text>
            <View className="gap-3">
              <TouchableOpacity
                onPress={() => pickImage(true)}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-4">
                <Camera size={20} color={isDark ? '#0a0a0a' : '#fafafa'} />
                <Text className="text-base font-semibold text-primary-foreground">Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => pickImage(false)}
                className="flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card py-4">
                <Image size={20} color={iconColor} />
                <Text className="text-base font-semibold text-foreground">Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
