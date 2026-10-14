import {useEffect,useState} from 'react';
import {updateGenerationSettings} from '../../api/tavernClient';
import {TavernApiError,type GenerationSettings,type GenerationSettingsState} from './types';
export interface GenerationSettingsProps{conversationId:string;settings:GenerationSettings;version:number;csrfToken:string;onUpdated:(state:GenerationSettingsState)=>void;onConflict:()=>Promise<void>;onBusyChange?:(busy:boolean)=>void}
export function useGenerationSettings({conversationId,settings,version,csrfToken,onUpdated,onConflict,onBusyChange}:GenerationSettingsProps){
  const [temperature, setTemperature] = useState(settings.temperature?.toString() ?? '');
  const [maxOutputTokens, setMaxOutputTokens] = useState(settings.maxOutputTokens?.toString() ?? '');
  const [stopSequences, setStopSequences] = useState(settings.stopSequences.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  useEffect(() => {
    setTemperature(settings.temperature?.toString() ?? '');
    setMaxOutputTokens(settings.maxOutputTokens?.toString() ?? '');
    setStopSequences(settings.stopSequences.join('\n'));
  }, [settings, version]);

  async function save() {
    if (busy) return;
    setBusy(true); setError(null); setSavedVersion(null);
    const parsedTemperature = temperature.trim() === '' ? undefined : Number(temperature);
    const next: GenerationSettings = {
      ...(parsedTemperature === undefined ? {} : { temperature: parsedTemperature }),
      maxOutputTokens: maxOutputTokens.trim() === '' ? null : Number(maxOutputTokens),
      stopSequences: stopSequences.split(/\r?\n/u).map(value => value.trim()).filter(Boolean),
    };
    try {
      const state = await updateGenerationSettings(conversationId, version, next, csrfToken);
      onUpdated(state); setSavedVersion(state.generationSettingsVersion);
    } catch (failure) {
      setError(failure);
      if (failure instanceof TavernApiError && failure.status === 409) await onConflict().catch(() => undefined);
    }
    finally { setBusy(false); }
  }

  return {temperature,setTemperature,maxOutputTokens,setMaxOutputTokens,stopSequences,setStopSequences,busy,error,savedVersion,save};
}
