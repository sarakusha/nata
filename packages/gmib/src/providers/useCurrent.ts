/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { useCallback } from 'react';
import { useDevicesContext } from './DevicesProvier';
import { useTests } from './TestProvider';

const useCurrent = (scope: 'test' | 'device') => {
  const { setCurrent: setCurrentDevice } = useDevicesContext();
  const { setCurrent: setCurrentTest } = useTests();
  return useCallback(
    (id: string | null) => {
      if (scope === 'test') {
        setCurrentTest(id);
        setCurrentDevice(null);
      } else {
        setCurrentDevice(id);
        setCurrentTest(null);
      }
    },
    [setCurrentDevice, setCurrentTest],
  );
};

export default useCurrent;
