import {useEffect,useState} from 'react';
import {parseKiteInstruments} from '../lib/kite.js';

let lookup;
export function useKiteInstruments() {
  const [state,setState]=useState({tokens:new Map(),loading:true,error:''});
  useEffect(()=>{
    let active=true;
    lookup??=fetch('/api/kite-instruments').then(async response=>{
      if(!response.ok)throw Error('Kite charts are temporarily unavailable');
      return parseKiteInstruments(await response.text());
    }).catch(error=>{lookup=null;throw error;});
    lookup.then(tokens=>{if(active)setState({tokens,loading:false,error:''});})
      .catch(error=>{if(active)setState({tokens:new Map(),loading:false,error:error.message});});
    return ()=>{active=false;};
  },[]);
  return state;
}
