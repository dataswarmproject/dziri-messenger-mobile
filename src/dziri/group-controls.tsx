import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { dziriApi } from './api';
import { useColors } from './ui';
import { useLocale } from './locale';
import { Text, TextInput } from './typography';
import { PersonAvatar } from './screen-parts';
import { IconButton } from './icons';
import { groupMemberActions, type GroupMemberAction } from './message-action-policy.generated';
type Confirmation = { action: GroupMemberAction | 'add' | 'leave'; userId?: string; name: string };
export function GroupControls({
  threadId,
  title,
  role,
  writable,
  leave,
}: {
  threadId: string;
  title: string;
  role: string;
  writable: boolean;
  leave: () => void;
}) {
  const members = usePaginatedQuery(dziriApi.groupMembers, { threadId }, { initialNumItems: 30 });
  const me = useQuery(dziriApi.me, {}),
    { t, rtl } = useLocale(),
    colors = useColors();
  const [search, setSearch] = useState(''),
    [adding, setAdding] = useState(false),
    [renaming, setRenaming] = useState(false),
    [name, setName] = useState(title);
  const [selected, setSelected] = useState<string | null>(null),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const candidates = useQuery(
    dziriApi.searchPeople,
    adding && search.trim().length >= 2 ? { q: search.trim() } : 'skip',
  );
  const add = useMutation(dziriApi.groupAdd),
    rename = useMutation(dziriApi.groupRename),
    change = useMutation(dziriApi.groupUpdateMember),
    exit = useMutation(dziriApi.groupLeave);
  const admin = writable && ['owner', 'admin'].includes(role);
  useEffect(() => {
    if (!confirmation || busy || confirmation.action === 'leave') return;
    const member = members.results.find(row => row.userId === confirmation.userId);
    const allowed =
      confirmation.action === 'add'
        ? admin
        : !!member &&
          groupMemberActions(
            role,
            member.role,
            member.userId === me?._id,
            writable,
            member.available,
          ).includes(confirmation.action);
    if (!allowed) {
      setConfirmation(null);
      setError(t.actionFailed);
    }
  }, [confirmation, busy, members.results, admin, role, me?._id, writable, t.actionFailed]);
  const labels = {
    remove: t.removeMember,
    promote: t.makeAdmin,
    demote: t.removeAdmin,
    transfer: t.transferOwnership,
    add: t.addPeople,
    leave: t.leaveGroup,
  };
  async function run(action: () => Promise<unknown>, success: () => void) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      success();
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message.includes('ownership')
          ? t.transferBeforeLeave
          : t.actionFailed,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    const value = confirmation;
    if (!value) return;
    if (value.action === 'leave') return run(() => exit({ threadId }), leave);
    if (!value.userId) return;
    if (value.action === 'add') {
      if (!admin) return;
      return run(
        () => add({ threadId, userIdToAdd: value.userId! }),
        () => {
          setConfirmation(null);
          setAdding(false);
          setSearch('');
        },
      );
    }
    const member = members.results.find(row => row.userId === value.userId);
    if (
      !member ||
      !groupMemberActions(
        role,
        member.role,
        member.userId === me?._id,
        writable,
        member.available,
      ).includes(value.action)
    )
      return;
    return run(
      () => change({ threadId, userId: value.userId!, action: value.action as GroupMemberAction }),
      () => {
        setConfirmation(null);
        setSelected(null);
      },
    );
  }
  const button = (label: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={action}
      style={{
        minHeight: 44,
        justifyContent: 'center',
        paddingVertical: 10,
        opacity: busy || disabled ? 0.5 : 1,
      }}>
      <Text style={{ fontSize: 14, color: colors.primary }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
      <Text style={{ paddingVertical: 12, fontSize: 13, color: colors.secondary }}>
        {t.members.toUpperCase()}
      </Text>
      {admin ? (
        <>
          {button(t.renameGroup, () => {
            setName(title);
            setRenaming(value => !value);
          })}
          {renaming ? (
            <>
              <TextInput
                accessibilityLabel={t.groupName}
                maxLength={80}
                value={name}
                onChangeText={setName}
                editable={!busy}
                style={{
                  minHeight: 44,
                  backgroundColor: colors.surface,
                  padding: 12,
                  borderRadius: 12,
                  color: colors.text,
                }}
              />
              {button(
                t.save,
                () =>
                  void run(
                    () => rename({ threadId, title: name.trim() }),
                    () => setRenaming(false),
                  ),
                !name.trim() || name.trim() === title,
              )}
            </>
          ) : null}
          {button(t.addPeople, () => setAdding(value => !value))}
          {adding ? (
            <>
              <TextInput
                accessibilityLabel={t.searchPeople}
                placeholder={t.searchPeople}
                placeholderTextColor={colors.secondary}
                value={search}
                onChangeText={setSearch}
                style={{
                  minHeight: 44,
                  backgroundColor: colors.surface,
                  padding: 12,
                  borderRadius: 12,
                  color: colors.text,
                }}
              />
              {candidates
                ?.filter(
                  row =>
                    row.userId !== me?._id &&
                    !members.results.some(member => member.userId === row.userId),
                )
                .map(row => (
                  <View key={row.userId}>
                    {button(row.name || row.handle || t.unknown, () =>
                      setConfirmation({
                        action: 'add',
                        userId: row.userId,
                        name: row.name || row.handle || t.unknown,
                      }),
                    )}
                  </View>
                ))}
            </>
          ) : null}
        </>
      ) : null}
      {members.status === 'LoadingFirstPage' ? (
        <ActivityIndicator color={colors.secondary} />
      ) : null}
      {members.results.map(member => {
        const actions = groupMemberActions(
          role,
          member.role,
          member.userId === me?._id,
          writable,
          member.available,
        );
        const display = member.name || t.unavailable;
        return (
          <View
            key={member.userId}
            style={{
              paddingVertical: 10,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.border,
            }}>
            <View
              style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
              <PersonAvatar name={display} image={member.image} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: colors.text }}>
                  {display}
                  {member.userId === me?._id ? ` · ${t.you}` : ''}
                </Text>
                <Text style={{ fontSize: 12, color: colors.secondary }}>
                  {member.role === 'owner'
                    ? t.groupOwner
                    : member.role === 'admin'
                      ? t.groupAdmin
                      : member.role === 'moderator'
                        ? t.groupModerator
                        : t.groupMember}
                </Text>
              </View>
              {actions.length ? (
                <IconButton
                  name="more"
                  label={`${t.more}: ${display}`}
                  color={colors.text}
                  onPress={() =>
                    setSelected(value => (value === member.userId ? null : member.userId))
                  }
                  disabled={busy}
                />
              ) : null}
            </View>
            {selected === member.userId
              ? actions.map(action => (
                  <View key={action}>
                    {button(labels[action], () =>
                      setConfirmation({ action, userId: member.userId, name: display }),
                    )}
                  </View>
                ))
              : null}
          </View>
        );
      })}
      {members.status === 'CanLoadMore' ? button(t.moreMembers, () => members.loadMore(30)) : null}
      {button(t.leaveGroup, () => setConfirmation({ action: 'leave', name: title }))}
      {role === 'owner' ? (
        <Text style={{ fontSize: 12, color: colors.secondary }}>{t.transferBeforeLeave}</Text>
      ) : null}
      {error && !confirmation ? (
        <Text accessibilityRole="alert" style={{ color: colors.text, paddingVertical: 12 }}>
          {error}
        </Text>
      ) : null}
      {confirmation ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!busy) setConfirmation(null);
          }}>
          <View
            accessibilityViewIsModal
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: 24,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}>
            <View
              style={{
                width: '100%',
                maxWidth: 420,
                alignSelf: 'center',
                padding: 24,
                borderRadius: 24,
                backgroundColor: colors.actionSurface,
              }}>
              <Text accessibilityRole="header" style={{ fontSize: 18, color: colors.text }}>
                {labels[confirmation.action]}
              </Text>
              <Text style={{ paddingVertical: 16, fontSize: 15, color: colors.secondary }}>
                {confirmation.name}
              </Text>
              {error ? (
                <Text accessibilityRole="alert" style={{ paddingBottom: 12, color: colors.text }}>
                  {error}
                </Text>
              ) : null}
              {busy ? <ActivityIndicator color={colors.secondary} /> : null}
              <View
                style={{
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  gap: 24,
                  justifyContent: 'flex-end',
                }}>
                {button(t.cancel, () => {
                  setConfirmation(null);
                  setError('');
                })}
                {button(t.confirm, () => void confirm())}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
