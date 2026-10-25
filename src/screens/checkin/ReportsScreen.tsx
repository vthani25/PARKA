import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button, Card, Choice, Gap, Heading, Label, T } from '../../components/ui';
import { dailyReportHtml, dailyReportText, weekDates, weeklyReportHtml, weeklyReportText } from '../../logic/reports';
import { atTime, dateKey } from '../../logic/time';
import { ScreenProps } from '../../navigation/types';
import { openTextMessage, reportData, sharePdf } from '../../services/share';
import { useApp } from '../../state/store';
import { colors, spacing } from '../../theme/tokens';

export function ReportsScreen({ navigation }: ScreenProps<'Reports'>) {
  const [kind, setKind] = useState<'daily' | 'weekly'>('daily');
  const [error, setError] = useState<string | null>(null);
  const recipients = useApp((s) => s.settings.recipients);
  const checkIns = useApp((s) => s.checkIns);
  const today = dateKey(new Date());
  const data = reportData();
  const text = kind === 'daily' ? dailyReportText(data, today) : weeklyReportText(data, today);

  const pdf = async () => {
    setError(null);
    try {
      const html = kind === 'daily' ? dailyReportHtml(data, today) : weeklyReportHtml(data, today);
      await sharePdf(html, kind === 'daily' ? 'Daily report' : 'Weekly report');
    } catch {
      setError('The PDF could not be shared.');
    }
  };

  const textTo = async (phone: string) => {
    setError(null);
    try {
      await openTextMessage(phone, text);
    } catch {
      setError('No messaging app was found on this phone.');
    }
  };

  const week = weekDates(today).map((date) => ({ date, score: checkIns.find((c) => c.date === date)?.dayScore }));

  return (
    <Screen>
      <Heading>Reports</Heading>
      <Choice label="Today’s report" selected={kind === 'daily'} onPress={() => setKind('daily')} />
      <Choice label="This week’s report" selected={kind === 'weekly'} onPress={() => setKind('weekly')} />
      <Gap size="sm" />

      {kind === 'weekly' && (
        <Card>
          <T size="large" bold accessibilityRole="header">
            Day scores
          </T>
          <Gap size="sm" />
          {week.map((w) => (
            <View key={w.date} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }} accessible accessibilityLabel={`${atTime(w.date, '12:00').toLocaleDateString('en-US', { weekday: 'long' })}: ${w.score ?? 'no check-in'}`}>
              <T size="body" style={{ width: 56 }}>
                {atTime(w.date, '12:00').toLocaleDateString('en-US', { weekday: 'short' })}
              </T>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {w.score !== undefined && <View style={{ height: 26, width: `${Math.max(w.score, 2) * 0.8}%`, backgroundColor: colors.pine, borderRadius: 4 }} />}
                <T size="body" bold>
                  {w.score ?? '—'}
                </T>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <T size="body">{text}</T>
      </Card>

      <Label size="large">Send it</Label>
      {recipients.length === 0 ? (
        <Card tint>
          <T size="body">Add a caregiver or doctor in Settings to text them reports.</T>
          <Gap size="sm" />
          <Button label="Add a person" size="normal" onPress={() => navigation.navigate('Recipients')} />
        </Card>
      ) : (
        recipients.map((r) => (
          <Button
            key={r.id}
            label={`Text to ${r.name}${r.relationship ? ` (${r.relationship})` : ''}`}
            onPress={() => textTo(r.phone)}
            accessibilityHint="Opens your messaging app with the report filled in. You tap send."
          />
        ))
      )}
      <Button label="Share PDF" variant="red" onPress={pdf} accessibilityHint="Opens the share menu, for email or other apps" />
      {error && <T size="body" color={colors.red}>{error}</T>}
      <Label size="small" bold={false}>
        PARKA never sends anything by itself. You choose who gets it and tap send.
      </Label>
    </Screen>
  );
}
