FROM e2b/base:latest

# python data science stack
RUN pip install pandas==2.2.3 matplotlib==3.9.3 plotly==6.0.1 seaborn==0.13.2 numpy==2.2.3

# integration SDK packages
RUN pip install stripe==11.5.0

# node packages for JS execution
RUN npm install -g stripe@17.5.0 @googlemaps/google-maps-services-js@3.4.0

# output directory for generated artifacts
RUN mkdir -p /output /data

USER user
