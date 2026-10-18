import {useCallback,useEffect,useState} from 'react';
import {request} from '../api.js';

export function useCompanies() {
  const [directory,setDirectory]=useState({companies:[],metadata:null,version:null});
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);try{setDirectory(await request('/api/companies'));setError('');}
    catch(e){setError(e.message);}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  return {directory,loading,error,load};
}
