import { useState } from 'react';

const LOCAL_STORAGE_KEY = 'aparture-profile-md';
const DEFAULT_PROFILE = `I work on [your field here]. I am interested in [specific sub-topics]. I am trying to keep up with [research threads]. Replace this text with your actual research interests in plain prose — every synthesis call will be grounded in what you write here.`;

function readStoredProfile() {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  return window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? DEFAULT_PROFILE;
}

export function useProfile() {
  const [profile, setProfile] = useState(readStoredProfile);

  const updateProfile = (value) => {
    setProfile(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, value);
    }
  };

  return [profile, updateProfile];
}
