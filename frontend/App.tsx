import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { FarmerProfile } from './src/types';
import { colors } from './src/theme/colors';

export default function App() {
  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'mr'>('en');

  const handleLoginSuccess = (selectedFarmer: FarmerProfile, jwtToken: string) => {
    setFarmer(selectedFarmer);
    setToken(jwtToken);
  };

  const handleLogout = () => {
    setFarmer(null);
    setToken(null);
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      {farmer && token ? (
        <RootNavigator
          farmer={farmer}
          language={language}
          onToggleLanguage={setLanguage}
          onLogout={handleLogout}
        />
      ) : (
        <LoginScreen
          language={language}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primaryDark },
});
