import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { font, uiColors } from "@/components/library-ui";

const c = uiColors;

export default function TabLayout() {
  const isWeb = Platform.OS === "web";
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accentForeground,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarLabelStyle: {
          fontFamily: font.semibold,
          fontSize: 10,
          marginTop: 1,
        },
        tabBarStyle: {
          height: isWeb ? 84 : 70,
          paddingTop: 7,
          paddingBottom: isWeb ? 34 : 8,
          backgroundColor: c.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
          elevation: 0,
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: c.card },
            ]}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "استكشف",
          tabBarIcon: ({ color }) => (
            <Feather name="compass" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "المحفوظات",
          tabBarIcon: ({ color }) => (
            <Feather name="bookmark" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="downloads"
        options={{
          title: "التنزيلات",
          tabBarIcon: ({ color }) => (
            <Feather name="download" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
