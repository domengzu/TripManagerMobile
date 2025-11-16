import { Stack } from 'expo-router';

export default function ScreensLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide default header, use custom headers in each screen
      }}
    >
      <Stack.Screen
        name="create-travel-request"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="travel-request-details"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="reject-travel-request"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
