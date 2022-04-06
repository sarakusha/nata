/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Box, Container, Paper, Tab, Tabs } from '@mui/material';
import { DeviceId } from '@nibus/core';
import React, { useState } from 'react';
import { useSelector } from '../store';
import { selectCurrentDevice } from '../store/currentSlice';
import FirmwareTab from './FirmwareTab';
import PropertyGridTab from './PropertyGridTab';
import TelemetryTab from './TelemetryTab';

type Props = {
  id: DeviceId;
};

type TabState = 'props' | 'telemetry' | 'firmware';

const DeviceTabs: React.FC<Props> = ({ id }) => {
  const device = useSelector(selectCurrentDevice);
  const isEmpty = !device || device.isEmptyAddress;
  const [value, setValue] = useState<TabState>('props');
  const mib = device?.mib;
  const isMinihost = mib?.startsWith('minihost');
  const isMinihost3 = mib === 'minihost3';
  if (!id) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: 1 }}>
      <Paper square>
        <Tabs
          value={value}
          indicatorColor="primary"
          textColor="primary"
          onChange={(_, newValue) => setValue(newValue ?? 'props')}
          variant="fullWidth"
        >
          <Tab label="Свойства" disabled={isEmpty} value="props" />
          {isMinihost && !isEmpty && (
            <Tab label="Телеметрия" disabled={isEmpty} value="telemetry" />
          )}
          {isMinihost3 && <Tab label="Прошивка" value="firmware" />}
        </Tabs>
      </Paper>
      <Container maxWidth={value !== 'telemetry' ? 'sm' : undefined} sx={{ flexGrow: 1, pt: 1 }}>
        <PropertyGridTab id={id} selected={value === 'props' && device !== undefined} />
        <TelemetryTab id={id} selected={value === 'telemetry' && device !== undefined} />
        <FirmwareTab id={id} selected={value === 'firmware' && device !== undefined} />
      </Container>
    </Box>
  );
};

export default React.memo(DeviceTabs);
