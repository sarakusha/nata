/* eslint-disable import/first */
/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
process.env.DEBUG = 'nibus:*';

import { AppContainer } from 'react-hot-loader';
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import React from 'react';
import ReactDOM from 'react-dom';
import 'typeface-roboto/index.css';

import App from '../components/App';
import DevicesProvider from '../providers/DevicesProvier';
import DevicesStateProvider from '../providers/DevicesStateProvider';
import SessionProvider from '../providers/SessionProvider';
import TestsProvider from '../providers/TestProvider';
import ToolbarProvider from '../providers/ToolbarProvider';

const theme = createMuiTheme({});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ELECTRON_DISABLE_SECURITY_WARNINGS = 1;

const render = (): void => {
  ReactDOM.render(
    (
      <AppContainer>
        <MuiThemeProvider theme={theme}>
          <SessionProvider>
            <DevicesProvider>
              <DevicesStateProvider>
                <ToolbarProvider>
                  <TestsProvider>
                    <App />
                  </TestsProvider>
                </ToolbarProvider>
              </DevicesStateProvider>
            </DevicesProvider>
          </SessionProvider>
        </MuiThemeProvider>
      </AppContainer>
    ),
    document.getElementById('app'),
  );
};

render();

if (module.hot) {
  module.hot.accept('../components/App', () => { render(); });
}
