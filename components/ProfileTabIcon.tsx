import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileTabIconProps {
  color: string;
  size?: number;
}

export const ProfileTabIcon: React.FC<ProfileTabIconProps> = ({ 
  color, 
  size = 24 
}) => {
  const { user } = useAuth();

  // If user has no profile picture, show default icon
  if (!user?.profile_picture) {
    return <IconSymbol size={size} name="person.fill" color={color} />;
  }

  // Calculate image size - slightly larger than icon to match visual weight
  const imageSize = size + 4;

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: user.profile_picture }}
        style={[
          styles.profileImage,
          {
            width: imageSize,
            height: imageSize,
            borderRadius: imageSize / 2,
            borderColor: color,
          }
        ]}
        contentFit="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    borderWidth: 2,
  },
});
