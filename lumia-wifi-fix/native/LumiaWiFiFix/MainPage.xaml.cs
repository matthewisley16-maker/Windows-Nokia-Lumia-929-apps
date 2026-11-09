using System;
using System.Windows;
using Microsoft.Phone.Controls;
using Microsoft.Phone.Tasks;

namespace LumiaWiFiFix
{
    public partial class MainPage : PhoneApplicationPage
    {
        public MainPage()
        {
            InitializeComponent();
        }

        private void OpenWiFiSettings_Click(object sender, RoutedEventArgs e)
        {
            // The only Wi-Fi capability WP8.1 gives an app: jump to the system Wi-Fi page.
            var task = new ConnectionSettingsTask
            {
                ConnectionSettingsType = ConnectionSettingsType.WiFi
            };
            task.Show();
        }
    }
}
