using System;
using System.Windows;
using System.Windows.Navigation;
using Microsoft.Phone.Controls;
using Microsoft.Phone.Shell;

namespace LumiaWiFiFix
{
    public partial class App : Application
    {
        public static PhoneApplicationFrame RootFrame { get; private set; }

        private bool _phoneApplicationInitialized;

        public App()
        {
            InitializeComponent();
            UnhandledException += Application_UnhandledException;
            InitializePhoneApplication();
        }

        private void Application_Launching(object sender, LaunchingEventArgs e)
        {
        }

        private void Application_Activated(object sender, ActivatedEventArgs e)
        {
        }

        private void Application_Deactivated(object sender, DeactivatedEventArgs e)
        {
        }

        private void Application_Closing(object sender, ClosingEventArgs e)
        {
        }

        private void RootFrame_NavigationFailed(object sender, NavigationFailedEventArgs e)
        {
            if (System.Diagnostics.Debugger.IsAttached)
            {
                System.Diagnostics.Debugger.Break();
            }
        }

        private void Application_UnhandledException(object sender, ApplicationUnhandledExceptionEventArgs e)
        {
            if (System.Diagnostics.Debugger.IsAttached)
            {
                System.Diagnostics.Debugger.Break();
            }
        }

        private void InitializePhoneApplication()
        {
            if (_phoneApplicationInitialized)
            {
                return;
            }

            if (RootFrame == null)
            {
                RootFrame = new PhoneApplicationFrame();
                RootFrame.Navigated += CompleteInitializePhoneApplication;
                RootFrame.NavigationFailed += RootFrame_NavigationFailed;
            }

            _phoneApplicationInitialized = true;
        }

        private void CompleteInitializePhoneApplication(object sender, NavigationEventArgs e)
        {
            if (RootVisual != RootFrame)
            {
                RootVisual = RootFrame;
            }

            RootFrame.Navigated -= CompleteInitializePhoneApplication;
        }
    }
}
