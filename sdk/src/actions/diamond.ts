import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { DiamondAbi } from '../abis/diamond';
import { DIAMOND_ADDRESS } from '../constants/addresses';
