import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useQuery, useConvexConnectionState } from 'convex/react';
import { randomUUID } from 'expo-crypto';
import { makeFunctionReference } from 'convex/server';
import { Text } from '../dziri/typography';
import { useLocale } from '../dziri/locale';
import { colorsFor } from '../dziri/theme';
import {
  eligibleStaffBusinesses,
  validStaffWorkspace,
  staffWorkspaceKey,
  staffCopy,
  type StaffEntryProps,
  type StaffWorkspace,
} from '../dziri/messenger-staff.generated';
import InboxApp from './app';
const workspaceRef = makeFunctionReference<
  'query',
  { companyId: string; expectedActorId: string; observationId: string },
  StaffWorkspace | null
>('inbox/workspace:current');
const colors = colorsFor(true);
export default function StaffWorkspaceEntry(props: StaffEntryProps) {
  return (
    <Choices
      key={JSON.stringify([
        props.actorId,
        props.businesses.map(b => [b.id, b.role]),
        props.supported,
      ])}
      {...props}
    />
  );
}
function Choices({ actorId, businesses, supported }: StaffEntryProps) {
  const choices = eligibleStaffBusinesses(businesses),
    { locale } = useLocale(),
    copy = staffCopy(locale);
  const [company, setCompany] = useState(choices.length === 1 ? choices[0].id : '');
  if (!supported || !choices.length)
    return (
      <Text accessibilityRole="alert" style={{ color: colors.text, padding: 20 }}>
        {copy.unavailable}
      </Text>
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {choices.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            padding: 12,
            gap: 8,
            flexDirection: locale === 'ar' ? 'row-reverse' : 'row',
          }}>
          {choices.map(b => (
            <Pressable
              key={b.id}
              accessibilityRole="radio"
              aria-checked={company === b.id}
              accessibilityState={{ checked: company === b.id }}
              onPress={() => setCompany(b.id)}
              style={{
                minHeight: 44,
                padding: 12,
                borderWidth: 1,
                borderColor: company === b.id ? colors.text : colors.border,
                borderRadius: 12,
              }}>
              <Text style={{ color: colors.text }}>{b.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {company ? (
        <BoundWorkspace key={actorId + company} actorId={actorId} companyId={company} />
      ) : (
        <Text style={{ color: colors.text, padding: 20 }}>{copy.choose}</Text>
      )}
    </View>
  );
}
function BoundWorkspace({ actorId, companyId }: { actorId: string; companyId: string }) {
  const connection = useConvexConnectionState(),
    { locale } = useLocale();
  if (!connection.isWebSocketConnected)
    return (
      <Text accessibilityRole="alert" style={{ color: colors.text, padding: 20 }}>
        {staffCopy(locale).unavailable}
      </Text>
    );
  return <ObservedWorkspace actorId={actorId} companyId={companyId} />;
}
function ObservedWorkspace({ actorId, companyId }: { actorId: string; companyId: string }) {
  const [observationId] = useState(randomUUID);
  const value = useQuery(workspaceRef, { companyId, expectedActorId: actorId, observationId }),
    { locale } = useLocale(),
    copy = staffCopy(locale);
  if (value === undefined)
    return <Text style={{ color: colors.text, padding: 20 }}>{copy.loading}</Text>;
  if (value === null)
    return (
      <Text accessibilityRole="alert" style={{ color: colors.text, padding: 20 }}>
        {copy.workspaceSetupRequired}
      </Text>
    );
  if (!validStaffWorkspace(value, actorId, companyId) || value.observationId !== observationId)
    return (
      <Text accessibilityRole="alert" style={{ color: colors.text, padding: 20 }}>
        {copy.workspaceReconnect}
      </Text>
    );
  return <InboxApp key={staffWorkspaceKey(value)} workspace={value} />;
}
