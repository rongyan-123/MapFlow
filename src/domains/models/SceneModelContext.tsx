import {createContext,useContext,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {readSceneModels,migrateSceneModels,saveSceneModel,type SceneModelEntries} from '../../api/studyPlanClient';
import {modelPurposes,readLegacyScenePreference,type ModelPurpose,type SceneModelPreference} from './scenePreferences';
interface State{entries:SceneModelEntries;credentials:Partial<Record<ModelPurpose,string>>;ready:boolean;error:unknown;reload:()=>void;save:(purpose:ModelPurpose,expectedVersion:number,settings:SceneModelPreference,apiKey?:string)=>Promise<void>}
const Context=createContext<State|null>(null);
export function SceneModelsProvider({accountId,csrfToken,children}:{accountId:string;csrfToken?:string;children:ReactNode}){
  const client=useQueryClient();const key=['me',accountId,'scene-models'];
  const [credentials,setCredentials]=useState<State['credentials']>({});
  const query=useQuery({queryKey:key,enabled:!!csrfToken,retry:false,queryFn:async()=>{const saved=await readSceneModels();return modelPurposes.some(purpose=>!saved[purpose])?migrateSceneModels(readLegacyScenePreference(accountId),csrfToken!):saved;}});
  async function save(purpose:ModelPurpose,expectedVersion:number,settings:SceneModelPreference,apiKey?:string){
    const saved=await saveSceneModel(purpose,expectedVersion,settings,csrfToken!);
    client.setQueryData<SceneModelEntries>(key,previous=>({...previous,[purpose]:saved}));
    if(apiKey!==undefined)setCredentials(previous=>({...previous,[purpose]:apiKey}));
  }
  return <Context.Provider value={csrfToken?{entries:query.data??{},credentials,ready:query.isSuccess,error:query.error,reload:()=>void query.refetch(),save}:null}>{children}</Context.Provider>;
}
export const useSceneModels=()=>useContext(Context);
