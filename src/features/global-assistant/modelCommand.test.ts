import {expect,it} from 'vitest';
import {globalModelCommand} from './modelCommand';
import type {TavernModelSelection} from '../../domains/conversations/types';

const selection:TavernModelSelection={provider:'custom',apiKey:'test-ephemeral-key',model:'original-model',baseUrl:'https://model.example/v1',settings:{},historyBytes:8192};
it('keeps the chosen funding profile or complete BYOK snapshot without borrowing another channel',()=>{
  expect(globalModelCommand({funding:'cash',profileId:'chosen-profile',profileVersion:4},selection)).toEqual({funding:'cash',profileId:'chosen-profile',profileVersion:4});
  expect(globalModelCommand({funding:'points',modelId:'points-model'},selection)).toEqual({funding:'points'});
  expect(globalModelCommand({funding:'byok',contextWindow:128000,maxOutputTokens:4000,reasoningProtocol:'deepseek',reasoningSupported:true},selection)).toEqual({funding:'byok',modelAccess:{apiKey:'test-ephemeral-key',model:'original-model',baseUrl:'https://model.example/v1',contextWindow:128000,maxOutputTokens:4000,reasoningProtocol:'deepseek',reasoningSupported:true}});
});
it('requires a usable original channel and valid credentials before admission',()=>{
  expect(()=>globalModelCommand({funding:'cash'},selection)).toThrow('可用的现金模型');
  expect(()=>globalModelCommand({funding:'points'},selection)).toThrow('积分模型暂未配置');
  expect(()=>globalModelCommand({funding:'byok',contextWindow:128000},{...selection,provider:'platform'})).toThrow('模型设置');
  expect(()=>globalModelCommand({funding:'byok',contextWindow:0},selection)).toThrow('实际上下文窗口');
  expect(()=>globalModelCommand({funding:'byok',contextWindow:128000},{...selection,apiKey:''})).toThrow('API Key');
});
