import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchAdminRequestObservation,fetchAdminRequestObservations} from '../../api/adminClient';
import type {RequestObservationFilter} from './types';
import type {Administrator} from './useAdministration';
export function useRequestObservations({accountId,csrfToken}:Administrator){
  const [filter,setFilter]=useState<RequestObservationFilter>({});const [offset,setOffset]=useState(0);const [requestId,setRequestId]=useState<string|null>(null);
  const query=useQuery({queryKey:['admin',accountId,'request-observations',filter,offset],queryFn:()=>fetchAdminRequestObservations(csrfToken,{...filter,limit:50,offset}),retry:false});
  const detail=useQuery({queryKey:['admin',accountId,'request-observation',requestId],queryFn:()=>fetchAdminRequestObservation(csrfToken,requestId!),enabled:!!requestId,retry:false});
  return {filter,setFilter,offset,setOffset,requestId,setRequestId,query,detail};
}
